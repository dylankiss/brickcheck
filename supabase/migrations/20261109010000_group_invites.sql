-- Groups 2: Group invites, joining, the 20-member cap and the membership
-- refresh broadcast. See ARCHITECTURE.md ("Invites", "Data model", "Security
-- rules") and docs/adr/0001-group-access-is-derived.md. Mirrors the per-Set
-- invites (20261103010000, 20261103030000).

------------------------------------------------------------------------------
-- Group invites
------------------------------------------------------------------------------

create table public.group_invites (
  token uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  role public.set_role not null default 'helper' check (role <> 'owner'),
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  check (expires_at <= created_at + interval '30 days')
);

create index group_invites_group_id_idx on public.group_invites (group_id);
create index group_invites_created_by_idx on public.group_invites (created_by);

-- When an Owner removes someone, links created before that no longer work for
-- them; a newer link does. Leaving on your own is not recorded. Written only by
-- the security definer functions below.
create table public.group_removals (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_removals_user_id_idx on public.group_removals (user_id);

alter table public.group_invites enable row level security;
alter table public.group_removals enable row level security;

revoke all on public.group_invites, public.group_removals from anon, authenticated;

create policy "group_invites: owner reads" on public.group_invites
  for select to authenticated
  using (public.is_group_owner(group_id));

create policy "group_invites: owner creates" on public.group_invites
  for insert to authenticated
  with check (public.is_group_owner(group_id) and created_by = (select auth.uid()));

create policy "group_invites: owner deletes" on public.group_invites
  for delete to authenticated
  using (public.is_group_owner(group_id));

grant select, delete on public.group_invites to authenticated;
grant insert (group_id, role, expires_at) on public.group_invites to authenticated;

------------------------------------------------------------------------------
-- Recording removals
------------------------------------------------------------------------------

create function public.record_group_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Not when leaving on your own, and not when the whole Group is being deleted.
  if old.user_id is distinct from (select auth.uid())
     and exists (select 1 from public.groups where id = old.group_id) then
    insert into public.group_removals (group_id, user_id)
    values (old.group_id, old.user_id)
    on conflict (group_id, user_id) do update set removed_at = now();
  end if;
  return null;
end;
$$;

create trigger group_members_record_removal
  after delete on public.group_members
  for each row execute function public.record_group_removal();

------------------------------------------------------------------------------
-- The 20-member cap
------------------------------------------------------------------------------

create function public.group_members_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serialise concurrent joins to the same Group, so the cap holds.
  perform pg_advisory_xact_lock(hashtext('group_members:' || new.group_id::text));
  if (
    select count(*) from public.group_members gm where gm.group_id = new.group_id
  ) >= 20 then
    raise exception 'A group can have at most 20 members' using errcode = '54000';
  end if;
  return new;
end;
$$;

create trigger group_members_before_insert
  before insert on public.group_members
  for each row execute function public.group_members_before_insert();

------------------------------------------------------------------------------
-- Preview and accept
------------------------------------------------------------------------------

-- What a valid Group invite leads to. No row for unknown, expired or (for a
-- removed person) older tokens.
create function public.group_invite_preview(p_token uuid)
returns table (
  group_id uuid,
  group_name text,
  role public.set_role,
  invited_by text,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    g.name,
    i.role,
    p.display_name,
    public.group_role_of(g.id) is not null
  from public.group_invites i
  join public.groups g on g.id = i.group_id
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token
    and i.expires_at > now()
    and not exists (
      select 1 from public.group_removals r
      where r.group_id = i.group_id
        and r.user_id = (select auth.uid())
        and r.removed_at >= i.created_at
    );
$$;

-- Adds the current user to the invite's Group. Never changes the role of an
-- existing member and never grants owner. Returns the Group id.
create function public.accept_group_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_group_id uuid;
  v_role public.set_role;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  select i.group_id, i.role, i.created_at into v_group_id, v_role, v_created_at
  from public.group_invites i
  where i.token = p_token
    and i.expires_at > now();

  if v_group_id is null then
    raise exception 'This invite link is invalid or has expired' using errcode = 'P0002';
  end if;

  -- An existing member keeps their role (and may open the link of a full Group).
  if exists (
    select 1 from public.group_members gm
    where gm.group_id = v_group_id and gm.user_id = v_user_id
  ) then
    return v_group_id;
  end if;

  if exists (
    select 1 from public.group_removals r
    where r.group_id = v_group_id and r.user_id = v_user_id and r.removed_at >= v_created_at
  ) then
    raise exception 'This invite link is invalid or has expired' using errcode = 'P0002';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (v_group_id, v_user_id, v_role)
  on conflict (group_id, user_id) do nothing;

  -- Let back in by an Owner (with a newer link): the removal no longer applies.
  delete from public.group_removals where group_id = v_group_id and user_id = v_user_id;

  return v_group_id;
end;
$$;

------------------------------------------------------------------------------
-- Group membership changes reach open pages: one `changed` broadcast on the
-- channel of each of the Group's Sets (same event as set_change_broadcast), so
-- pages refresh when someone joins, and later when someone leaves or is removed.
------------------------------------------------------------------------------

create function public.group_change_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid := coalesce(new.group_id, old.group_id);
  v_set_id uuid;
begin
  for v_set_id in select s.id from public.sets s where s.group_id = v_group_id loop
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'op', tg_op),
      'changed',
      'set:' || v_set_id::text,
      true
    );
  end loop;
  return null;
end;
$$;

create trigger group_members_broadcast
  after insert or update or delete on public.group_members
  for each row execute function public.group_change_broadcast();

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------

revoke execute on function
  public.record_group_removal(),
  public.group_members_before_insert(),
  public.group_change_broadcast()
from public, anon, authenticated;

revoke execute on function
  public.group_invite_preview(uuid),
  public.accept_group_invite(uuid)
from public, anon;
grant execute on function
  public.group_invite_preview(uuid),
  public.accept_group_invite(uuid)
to authenticated;
