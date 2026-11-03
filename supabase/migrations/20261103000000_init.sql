-- BrickCheck initial schema. See ARCHITECTURE.md for the model and security rules.

create extension if not exists pg_trgm with schema extensions;

-- Supabase grants everything on new objects to anon by default. Nothing in this
-- app is public, so objects created by later migrations start closed to anon too.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

------------------------------------------------------------------------------
-- Profiles
------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (length(display_name) <= 100),
  avatar_url text check (length(avatar_url) <= 500 and avatar_url ~ '^https://'),
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 100),
    case
      when new.raw_user_meta_data ->> 'avatar_url' ~ '^https://'
       and length(new.raw_user_meta_data ->> 'avatar_url') <= 500
      then new.raw_user_meta_data ->> 'avatar_url'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------
-- Shared set cache
--   lego_sets: catalog, seeded from Rebrickable's CSV dump (scripts/import-catalog.mjs)
--   inventory_lines: inventories, imported on demand by the fetch-set Edge Function
------------------------------------------------------------------------------

create table public.lego_sets (
  set_num text primary key,
  name text not null,
  year int,
  theme_id int,
  num_parts int not null default 0,
  img_url text,
  -- Set once the full inventory is stored; the inventory is immutable after that.
  parts_fetched_at timestamptz,
  created_at timestamptz not null default now()
);

create index lego_sets_name_trgm_idx on public.lego_sets using gin (name extensions.gin_trgm_ops);
create index lego_sets_set_num_pattern_idx on public.lego_sets (set_num text_pattern_ops);

create table public.inventory_lines (
  id bigint generated always as identity primary key,
  set_num text not null references public.lego_sets (set_num) on delete restrict,
  part_num text not null,
  part_name text not null,
  part_cat_id int,
  color_id int not null,
  color_name text not null,
  color_rgb text,
  is_trans boolean not null default false,
  img_url text,
  element_id text,
  bricklink_part_id text,
  bricklink_color_id int,
  quantity int not null check (quantity > 0),
  is_spare boolean not null default false,
  -- Null for the set's own parts; the minifig (e.g. fig-001234) for minifig parts.
  fig_num text,
  constraint inventory_lines_line_key unique nulls not distinct (set_num, part_num, color_id, is_spare, fig_num)
);

-- Cache misses that hit Rebrickable, for per-user rate limiting in fetch-set.
create table public.set_import_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  set_num text not null,
  created_at timestamptz not null default now()
);

create index set_import_log_user_created_idx on public.set_import_log (user_id, created_at);

------------------------------------------------------------------------------
-- Checks
------------------------------------------------------------------------------

create type public.check_role as enum ('owner', 'helper', 'viewer');

create table public.checks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  set_num text not null references public.lego_sets (set_num) on delete restrict,
  title text not null check (length(title) between 1 and 200),
  -- Fixed at creation (no update grant): changing them would orphan progress rows.
  include_spares boolean not null default false,
  include_minifigs boolean not null default true,
  created_at timestamptz not null default now()
);

create index checks_owner_id_idx on public.checks (owner_id);
create index checks_set_num_idx on public.checks (set_num);

create table public.check_members (
  check_id uuid not null references public.checks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.check_role not null,
  joined_at timestamptz not null default now(),
  primary key (check_id, user_id)
);

create index check_members_user_id_idx on public.check_members (user_id);

create table public.check_progress (
  check_id uuid not null references public.checks (id) on delete cascade,
  line_id bigint not null references public.inventory_lines (id) on delete restrict,
  found_qty int not null default 0 check (found_qty >= 0),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (check_id, line_id)
);

create index check_progress_updated_by_idx on public.check_progress (updated_by);

create table public.check_invites (
  token uuid primary key default gen_random_uuid(),
  check_id uuid not null references public.checks (id) on delete cascade,
  role public.check_role not null default 'helper' check (role <> 'owner'),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  check (expires_at <= created_at + interval '30 days')
);

create index check_invites_check_id_idx on public.check_invites (check_id);

------------------------------------------------------------------------------
-- Functions
------------------------------------------------------------------------------

-- The one rule deciding whether an inventory line counts for a check.
-- Only used in SQL (check_lines, adjust_part); the client never re-implements it.
create function public.line_counts(
  p_include_spares boolean,
  p_include_minifigs boolean,
  p_is_spare boolean,
  p_fig_num text
)
returns boolean
language sql
immutable
-- No search_path clause: it references no objects, and SET would prevent inlining.
as $$
  select (p_include_spares or not p_is_spare)
     and (p_include_minifigs or p_fig_num is null);
$$;

create function public.check_role_of(p_check_id uuid)
returns public.check_role
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.check_members m
  where m.check_id = p_check_id
    and m.user_id = (select auth.uid());
$$;

-- All checks the current user belongs to. Policies use
-- `check_id in (select public.my_check_ids())`, which runs once per query
-- instead of once per row.
create function public.my_check_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.check_id
  from public.check_members m
  where m.user_id = (select auth.uid());
$$;

create function public.is_check_member(p_check_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.check_role_of(p_check_id) is not null;
$$;

-- Owner or helper: may tick off parts and rename the check.
create function public.is_check_helper(p_check_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.check_role_of(p_check_id) in ('owner', 'helper'), false);
$$;

create function public.is_check_owner(p_check_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.check_role_of(p_check_id) = 'owner', false);
$$;

-- True when the current user and p_user_id are both members of some check.
create function public.shares_check_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.check_members mine
    join public.check_members theirs on theirs.check_id = mine.check_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = p_user_id
  );
$$;

-- 'check:<uuid>' -> uuid, anything else -> null.
create function public.check_id_from_topic(p_topic text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when p_topic ~ '^check:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then substr(p_topic, 7)::uuid
  end;
$$;

------------------------------------------------------------------------------
-- Set import (service role only, called by the fetch-set Edge Function)
--   p_set:   {set_num, name, year, theme_id, num_parts, img_url}
--   p_parts: [{part_num, part_name, part_cat_id, color_id, color_name, color_rgb,
--              is_trans, img_url, element_id, bricklink_part_id, bricklink_color_id,
--              quantity, is_spare, fig_num}]
-- Atomic and idempotent: an already imported inventory is never touched.
------------------------------------------------------------------------------

create function public.import_set(p_set jsonb, p_parts jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_num text := p_set ->> 'set_num';
begin
  if v_set_num is null or jsonb_typeof(p_parts) <> 'array' or jsonb_array_length(p_parts) = 0 then
    raise exception 'Invalid import payload' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('import_set:' || v_set_num));

  if exists (
    select 1 from public.lego_sets
    where set_num = v_set_num and parts_fetched_at is not null
  ) then
    return;
  end if;

  insert into public.lego_sets (set_num, name, year, theme_id, num_parts, img_url)
  values (
    v_set_num,
    p_set ->> 'name',
    (p_set ->> 'year')::int,
    (p_set ->> 'theme_id')::int,
    coalesce((p_set ->> 'num_parts')::int, 0),
    p_set ->> 'img_url'
  )
  on conflict (set_num) do update
    set name = excluded.name,
        year = excluded.year,
        theme_id = excluded.theme_id,
        num_parts = excluded.num_parts,
        img_url = excluded.img_url;

  insert into public.inventory_lines (
    set_num, part_num, part_name, part_cat_id, color_id, color_name, color_rgb, is_trans,
    img_url, element_id, bricklink_part_id, bricklink_color_id, quantity, is_spare, fig_num
  )
  -- Rebrickable can list the same part + color twice (e.g. two element ids):
  -- merge them into one line so no quantity is lost.
  select
    v_set_num, p.part_num, min(p.part_name), min(p.part_cat_id), p.color_id, min(p.color_name),
    min(p.color_rgb), coalesce(bool_or(p.is_trans), false), min(p.img_url), min(p.element_id),
    min(p.bricklink_part_id), min(p.bricklink_color_id), sum(p.quantity),
    coalesce(p.is_spare, false), p.fig_num
  from jsonb_to_recordset(p_parts) as p (
    part_num text, part_name text, part_cat_id int, color_id int, color_name text,
    color_rgb text, is_trans boolean, img_url text, element_id text,
    bricklink_part_id text, bricklink_color_id int, quantity int, is_spare boolean,
    fig_num text
  )
  group by p.part_num, p.color_id, coalesce(p.is_spare, false), p.fig_num
  on conflict on constraint inventory_lines_line_key do nothing;

  update public.lego_sets set parts_fetched_at = now() where set_num = v_set_num;
end;
$$;

------------------------------------------------------------------------------
-- Import claims (service role only, called by fetch-set before it calls Rebrickable)
-- Atomically enforces the per-user hourly limit and refuses a second
-- concurrent import of the same set. Returns 'ok', 'rate_limited' or 'in_progress'.
------------------------------------------------------------------------------

create function public.claim_import(p_user_id uuid, p_set_num text, p_per_hour int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('claim_import'));

  if (
    select count(*) from public.set_import_log
    where user_id = p_user_id and created_at > now() - interval '1 hour'
  ) >= p_per_hour then
    return 'rate_limited';
  end if;

  -- fetch-set gives up after ~2 minutes, so an older claim is abandoned.
  if exists (
    select 1 from public.set_import_log
    where set_num = p_set_num and created_at > now() - interval '3 minutes'
  ) then
    return 'in_progress';
  end if;

  insert into public.set_import_log (user_id, set_num) values (p_user_id, p_set_num);
  return 'ok';
end;
$$;

create index set_import_log_set_created_idx on public.set_import_log (set_num, created_at);

------------------------------------------------------------------------------
-- Check lifecycle triggers
------------------------------------------------------------------------------

create function public.checks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.lego_sets s
    where s.set_num = new.set_num and s.parts_fetched_at is not null
  ) then
    raise exception 'Set % has no cached inventory yet', new.set_num
      using errcode = '23503';
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger checks_before_insert
  before insert on public.checks
  for each row execute function public.checks_before_insert();

create function public.checks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.check_members (check_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger checks_after_insert
  after insert on public.checks
  for each row execute function public.checks_after_insert();

------------------------------------------------------------------------------
-- Views (security_invoker: RLS of the underlying tables applies)
------------------------------------------------------------------------------

-- Every inventory line that counts for a check, with its progress.
create view public.check_lines
with (security_invoker = true)
as
select
  c.id as check_id,
  il.id as line_id,
  il.part_num,
  il.part_name,
  il.part_cat_id,
  il.color_id,
  il.color_name,
  il.color_rgb,
  il.is_trans,
  il.img_url,
  il.element_id,
  il.bricklink_part_id,
  il.bricklink_color_id,
  il.quantity,
  il.is_spare,
  il.fig_num,
  coalesce(cp.found_qty, 0) as found_qty,
  cp.updated_at
from public.checks c
join public.inventory_lines il on il.set_num = c.set_num
left join public.check_progress cp on cp.check_id = c.id and cp.line_id = il.id
where public.line_counts(c.include_spares, c.include_minifigs, il.is_spare, il.fig_num);

create view public.check_summaries
with (security_invoker = true)
as
select
  c.id,
  c.owner_id,
  c.set_num,
  c.title,
  c.include_spares,
  c.include_minifigs,
  c.created_at,
  s.name as set_name,
  s.year as set_year,
  s.img_url as set_img_url,
  m.role as my_role,
  coalesce(t.needed, 0)::int as needed,
  coalesce(t.found, 0)::int as found
from public.checks c
join public.lego_sets s on s.set_num = c.set_num
left join public.check_members m on m.check_id = c.id and m.user_id = (select auth.uid())
left join lateral (
  select sum(l.quantity) as needed, sum(l.found_qty) as found
  from public.check_lines l
  where l.check_id = c.id
) t on true;

------------------------------------------------------------------------------
-- RPC: adjust the found count of one part + color in a check.
-- One part in the UI can be backed by several lines (the set's own line,
-- minifig lines, a spare line). Increments fill set line -> minifig lines ->
-- spares; decrements undo in reverse. Rows are always locked in line_id
-- order, so concurrent increments and decrements cannot deadlock.
-- Returns the part's lines with their new counts (same shape as broadcasts).
-- Not idempotent: a retried call applies its delta again (accepted for taps).
------------------------------------------------------------------------------

create function public.adjust_part(
  p_check_id uuid,
  p_part_num text,
  p_color_id int,
  p_delta int
)
returns table (line_id bigint, found_qty int, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_remaining int := abs(p_delta);
  v_step int;
  v_line record;
  v_ids bigint[];
begin
  if p_delta is null or p_delta = 0 or abs(p_delta) > 10000 then
    raise exception 'Invalid delta' using errcode = '22023';
  end if;

  if not public.is_check_helper(p_check_id) then
    raise exception 'Not allowed to edit this check' using errcode = '42501';
  end if;

  select coalesce(array_agg(il.id order by il.id), '{}') into v_ids
  from public.checks c
  join public.inventory_lines il on il.set_num = c.set_num
  where c.id = p_check_id
    and il.part_num = p_part_num
    and il.color_id = p_color_id
    and public.line_counts(c.include_spares, c.include_minifigs, il.is_spare, il.fig_num);

  if cardinality(v_ids) = 0 then
    raise exception 'Part %/% is not part of this check', p_part_num, p_color_id
      using errcode = '22023';
  end if;

  -- Make sure every line has a progress row, then lock them in a fixed order.
  insert into public.check_progress (check_id, line_id, found_qty, updated_by)
  select p_check_id, id, 0, (select auth.uid())
  from unnest(v_ids) as id
  on conflict on constraint check_progress_pkey do nothing;

  perform 1
  from public.check_progress cp
  where cp.check_id = p_check_id and cp.line_id = any (v_ids)
  order by cp.line_id
  for update;

  for v_line in
    select cp.line_id, il.quantity, cp.found_qty
    from public.check_progress cp
    join public.inventory_lines il on il.id = cp.line_id
    where cp.check_id = p_check_id and cp.line_id = any (v_ids)
    order by
      sign(p_delta) * (case when il.is_spare then 2 when il.fig_num is not null then 1 else 0 end),
      sign(p_delta) * il.id
  loop
    exit when v_remaining = 0;
    if p_delta > 0 then
      v_step := least(v_remaining, v_line.quantity - v_line.found_qty);
    else
      v_step := least(v_remaining, v_line.found_qty);
    end if;
    if v_step > 0 then
      update public.check_progress cp
      set found_qty = cp.found_qty + sign(p_delta)::int * v_step,
          updated_by = (select auth.uid()),
          updated_at = clock_timestamp()
      where cp.check_id = p_check_id and cp.line_id = v_line.line_id;
      v_remaining := v_remaining - v_step;
    end if;
  end loop;

  return query
  select cp.line_id, cp.found_qty, cp.updated_at
  from public.check_progress cp
  where cp.check_id = p_check_id and cp.line_id = any (v_ids)
  order by cp.line_id;
end;
$$;

------------------------------------------------------------------------------
-- Realtime: progress changes are broadcast on the private channel
-- 'check:<id>'; only members may receive them or send presence there.
------------------------------------------------------------------------------

create function public.check_progress_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Zero rows inserted by adjust_part carry no news.
  if tg_op = 'UPDATE' and new.found_qty = old.found_qty then
    return null;
  end if;
  if tg_op = 'INSERT' and new.found_qty = 0 then
    return null;
  end if;
  perform realtime.send(
    jsonb_build_object(
      'line_id', new.line_id,
      'found_qty', new.found_qty,
      'updated_at', new.updated_at,
      'updated_by', new.updated_by
    ),
    'progress',
    'check:' || new.check_id::text,
    true
  );
  return null;
end;
$$;

create trigger check_progress_broadcast
  after insert or update on public.check_progress
  for each row execute function public.check_progress_broadcast();

create policy "check channels: members receive" on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and public.is_check_member(public.check_id_from_topic((select realtime.topic())))
  );

create policy "check channels: members send presence" on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension = 'presence'
    and public.is_check_member(public.check_id_from_topic((select realtime.topic())))
  );

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.lego_sets enable row level security;
alter table public.inventory_lines enable row level security;
alter table public.set_import_log enable row level security;
alter table public.checks enable row level security;
alter table public.check_members enable row level security;
alter table public.check_progress enable row level security;
alter table public.check_invites enable row level security;

-- Nothing is readable or writable without logging in. Every later migration
-- that adds a table or view must repeat this for it.
revoke all on all tables in schema public from anon;

-- profiles
create policy "profiles: read self and co-members" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_check_with(id));

create policy "profiles: update self" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;

-- set cache: read-only for users
create policy "lego_sets: read" on public.lego_sets
  for select to authenticated using (true);

create policy "inventory_lines: read" on public.inventory_lines
  for select to authenticated using (true);

revoke insert, update, delete on public.lego_sets, public.inventory_lines from authenticated;

-- set_import_log: service role only (no policies)
revoke all on public.set_import_log from authenticated;

-- checks
-- owner_id is part of the read rule so that insert ... returning works before
-- the after-insert trigger has added the owner membership.
create policy "checks: read as member" on public.checks
  for select to authenticated
  using (owner_id = (select auth.uid()) or id in (select public.my_check_ids()));

create policy "checks: create own" on public.checks
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "checks: helpers update" on public.checks
  for update to authenticated
  using (public.is_check_helper(id))
  with check (public.is_check_helper(id));

create policy "checks: owner deletes" on public.checks
  for delete to authenticated
  using (owner_id = (select auth.uid()));

revoke update on public.checks from authenticated;
grant update (title) on public.checks to authenticated;

-- check_members (rows are created by trigger, and by accept_invite in phase 2)
create policy "check_members: read as member" on public.check_members
  for select to authenticated
  using (check_id in (select public.my_check_ids()));

create policy "check_members: owner changes roles" on public.check_members
  for update to authenticated
  using (public.is_check_owner(check_id) and user_id <> (select auth.uid()))
  with check (role <> 'owner');

create policy "check_members: leave or owner removes" on public.check_members
  for delete to authenticated
  using (
    (user_id = (select auth.uid()) and role <> 'owner')
    or (public.is_check_owner(check_id) and user_id <> (select auth.uid()))
  );

revoke insert, update on public.check_members from authenticated;
grant update (role) on public.check_members to authenticated;

-- check_progress (written by adjust_part only)
create policy "check_progress: read as member" on public.check_progress
  for select to authenticated
  using (check_id in (select public.my_check_ids()));

revoke insert, update, delete on public.check_progress from authenticated;

-- check_invites
create policy "check_invites: owner reads" on public.check_invites
  for select to authenticated
  using (public.is_check_owner(check_id));

create policy "check_invites: owner creates" on public.check_invites
  for insert to authenticated
  with check (public.is_check_owner(check_id) and created_by = (select auth.uid()));

create policy "check_invites: owner deletes" on public.check_invites
  for delete to authenticated
  using (public.is_check_owner(check_id));

revoke insert, update on public.check_invites from authenticated;
grant insert (check_id, role, expires_at) on public.check_invites to authenticated;

-- PostgREST cannot use these, but nobody needs them either.
revoke truncate, references, trigger on all tables in schema public from authenticated;

-- views are read-only
revoke insert, update, delete on public.check_lines, public.check_summaries from authenticated;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------

-- Trigger functions: not callable.
revoke execute on function
  public.handle_new_user(),
  public.checks_before_insert(),
  public.checks_after_insert(),
  public.check_progress_broadcast()
from public, anon, authenticated;

-- Service role only.
revoke execute on function
  public.import_set(jsonb, jsonb),
  public.claim_import(uuid, text, int)
from public, anon, authenticated;
grant execute on function
  public.import_set(jsonb, jsonb),
  public.claim_import(uuid, text, int)
to service_role;

-- Logged-in users only.
revoke execute on function
  public.line_counts(boolean, boolean, boolean, text),
  public.check_id_from_topic(text),
  public.my_check_ids(),
  public.check_role_of(uuid),
  public.is_check_member(uuid),
  public.is_check_helper(uuid),
  public.is_check_owner(uuid),
  public.shares_check_with(uuid),
  public.adjust_part(uuid, text, int, int)
from public, anon;
