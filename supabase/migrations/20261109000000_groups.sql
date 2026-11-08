-- Groups 1: Groups, Group members and derived access. See ARCHITECTURE.md ("Data
-- model", "Security rules") and docs/adr/0001-group-access-is-derived.md.
--
-- A person in a Group has access to every Set in it because of that membership,
-- worked out by the membership helpers when access is checked. Nothing is copied
-- into set_members. Policies and Realtime channel policies keep using the helpers.

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 100),
  -- Counts towards the cap of 10 Groups per person. Kept (as null) when the
  -- creator's account is deleted.
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index groups_created_by_idx on public.groups (created_by);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.set_role not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

-- A Set is in at most one Group. A Group with Sets cannot be deleted (restrict).
alter table public.sets
  add column group_id uuid references public.groups (id) on delete restrict;

create index sets_group_id_idx on public.sets (group_id);

------------------------------------------------------------------------------
-- Group helpers
------------------------------------------------------------------------------

-- All Groups the current user belongs to.
create function public.my_group_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select gm.group_id
  from public.group_members gm
  where gm.user_id = (select auth.uid());
$$;

create function public.group_role_of(p_group_id uuid)
returns public.set_role
language sql
stable
security definer
set search_path = ''
as $$
  select gm.role
  from public.group_members gm
  where gm.group_id = p_group_id
    and gm.user_id = (select auth.uid());
$$;

create function public.is_group_owner(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.group_role_of(p_group_id) = 'owner', false);
$$;

------------------------------------------------------------------------------
-- Membership helpers, now Group-aware. Same names and signatures, so every
-- policy and function that uses them keeps working.
------------------------------------------------------------------------------

-- The highest of the per-Set role and the Group role. The enum is declared
-- owner, helper, viewer, so min() picks the highest. A Group Owner is an Owner.
create or replace function public.set_role_of(p_set_id uuid)
returns public.set_role
language sql
stable
security definer
set search_path = ''
as $$
  select min(r.role)
  from (
    select m.role
    from public.set_members m
    where m.set_id = p_set_id
      and m.user_id = (select auth.uid())
    union all
    select gm.role
    from public.sets s
    join public.group_members gm on gm.group_id = s.group_id
    where s.id = p_set_id
      and gm.user_id = (select auth.uid())
  ) r;
$$;

create or replace function public.my_set_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.set_id
  from public.set_members m
  where m.user_id = (select auth.uid())
  union
  select s.id
  from public.sets s
  join public.group_members gm on gm.group_id = s.group_id
  where gm.user_id = (select auth.uid());
$$;

-- True when the current user and p_user_id both have access to some Set, or are
-- in the same Group (a Group counts even before it has Sets).
create or replace function public.shares_set_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    -- a Set they are both members of
    exists (
      select 1
      from public.set_members mine
      join public.set_members theirs on theirs.set_id = mine.set_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_user_id
    )
    -- a Group they are both in
    or exists (
      select 1
      from public.group_members mine
      join public.group_members theirs on theirs.group_id = mine.group_id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_user_id
    )
    -- I am in a Group, they are a member of one of its Sets
    or exists (
      select 1
      from public.group_members mine
      join public.sets s on s.group_id = mine.group_id
      join public.set_members theirs on theirs.set_id = s.id
      where mine.user_id = (select auth.uid())
        and theirs.user_id = p_user_id
    )
    -- they are in a Group, I am a member of one of its Sets
    or exists (
      select 1
      from public.group_members theirs
      join public.sets s on s.group_id = theirs.group_id
      join public.set_members mine on mine.set_id = s.id
      where theirs.user_id = p_user_id
        and mine.user_id = (select auth.uid())
    );
$$;

------------------------------------------------------------------------------
-- Creating a Group: the cap, the creator as Owner
------------------------------------------------------------------------------

create function public.groups_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    -- Serialise concurrent creations by the same person, so the cap holds.
    perform pg_advisory_xact_lock(hashtext('groups:' || new.created_by::text));
    if (
      select count(*) from public.groups g where g.created_by = new.created_by
    ) >= 10 then
      raise exception 'You can create at most 10 groups' using errcode = '54000';
    end if;
  end if;
  new.created_at := now();
  return new;
end;
$$;

create trigger groups_before_insert
  before insert on public.groups
  for each row execute function public.groups_before_insert();

create function public.groups_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.group_members (group_id, user_id, role)
    values (new.id, new.created_by, 'owner');
  end if;
  return new;
end;
$$;

create trigger groups_after_insert
  after insert on public.groups
  for each row execute function public.groups_after_insert();

-- The only way for a user to create a Group (no insert grant), so creating and
-- becoming its Owner is one step and needs no "read my own new row" policy.
create function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  insert into public.groups (name, created_by)
  values (btrim(p_name), v_user_id)
  returning id into v_id;

  return v_id;
end;
$$;

------------------------------------------------------------------------------
-- A Set can be given a Group at creation, if the creator is an Owner or Helper
-- of that Group. (Moving existing Sets in and out comes later.)
------------------------------------------------------------------------------

create or replace function public.sets_before_insert()
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
    raise exception 'Catalog set % has no cached inventory yet', new.set_num
      using errcode = '23503';
  end if;

  if new.group_id is not null and not exists (
    select 1 from public.group_members gm
    where gm.group_id = new.group_id
      and gm.user_id = new.owner_id
      and gm.role in ('owner', 'helper')
  ) then
    raise exception 'Only an owner or helper of the group can add sets to it'
      using errcode = '42501';
  end if;

  new.created_at := now();
  return new;
end;
$$;

------------------------------------------------------------------------------
-- set_summaries: my_role is the effective role; the Group is added at the end.
-- group_name is null when the viewer cannot read the Group (a per-Set member
-- who is not in it).
------------------------------------------------------------------------------

create or replace view public.set_summaries
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
  s.name as catalog_name,
  s.year as catalog_year,
  s.img_url as catalog_img_url,
  public.set_role_of(c.id) as my_role,
  coalesce(t.needed, 0)::int as needed,
  coalesce(t.found, 0)::int as found,
  c.group_id,
  g.name as group_name
from public.sets c
join public.lego_sets s on s.set_num = c.set_num
left join public.groups g on g.id = c.group_id
left join lateral (
  select sum(l.quantity) as needed, sum(l.found_qty) as found
  from public.set_lines l
  where l.set_id = c.id
) t on true;

------------------------------------------------------------------------------
-- Row level security
------------------------------------------------------------------------------

alter table public.groups enable row level security;
alter table public.group_members enable row level security;

revoke all on public.groups, public.group_members from anon, authenticated;

-- groups: members read; Owners rename. Created through create_group only.
create policy "groups: read as member" on public.groups
  for select to authenticated
  using (id in (select public.my_group_ids()));

create policy "groups: owner renames" on public.groups
  for update to authenticated
  using (public.is_group_owner(id))
  with check (public.is_group_owner(id));

grant select on public.groups to authenticated;
grant update (name) on public.groups to authenticated;

-- group_members: members read each other. Rows are created by trigger for now.
create policy "group_members: read as member" on public.group_members
  for select to authenticated
  using (group_id in (select public.my_group_ids()));

grant select on public.group_members to authenticated;

-- A Group Owner is an Owner of every Set in the Group, so deleting a Set follows
-- the effective role, not only the person who added it.
drop policy "sets: owner deletes" on public.sets;
create policy "sets: owner deletes" on public.sets
  for delete to authenticated
  using (public.is_set_owner(id));

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------

revoke execute on function
  public.groups_before_insert(),
  public.groups_after_insert()
from public, anon, authenticated;

revoke execute on function
  public.my_group_ids(),
  public.group_role_of(uuid),
  public.is_group_owner(uuid),
  public.create_group(text)
from public, anon;
grant execute on function
  public.my_group_ids(),
  public.group_role_of(uuid),
  public.is_group_owner(uuid),
  public.create_group(text)
to authenticated;
