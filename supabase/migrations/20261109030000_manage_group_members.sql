-- Groups 4: manage Group members. See ARCHITECTURE.md ("Data model", "Security
-- rules", "Invites") and docs/adr/0001-group-access-is-derived.md.
--
-- Owners change roles and remove members straight on group_members, through RLS
-- policies (like set_members). Two triggers hold the rules that must not depend
-- on who does the change, so leaving (a later step) gets them for free:
--   * group_members_guard_last_owner: a Group always keeps at least one Owner.
--   * group_members_drop_adder_access: when someone stops being a member, they
--     lose the per-Set Owner row that adding a Set gave them in that Group.
-- Removal is recorded by record_group_removal and refreshed by
-- group_change_broadcast, both from 20261109010000.

------------------------------------------------------------------------------
-- Policies and grants: Owners only
------------------------------------------------------------------------------

-- Only the role can change (promote to Owner, or change to Helper or Viewer).
-- The new row needs no check: user_id and group_id are not updatable.
create policy "group_members: owner changes roles" on public.group_members
  for update to authenticated
  using (public.is_group_owner(group_id))
  with check (true);

-- Owners remove any member, including other Owners and themselves. Leaving is
-- not allowed for members yet (a later step), and the last-Owner rule below
-- stops the last Owner.
create policy "group_members: owner removes" on public.group_members
  for delete to authenticated
  using (public.is_group_owner(group_id));

grant update (role) on public.group_members to authenticated;
grant delete on public.group_members to authenticated;

------------------------------------------------------------------------------
-- The last-Owner rule, in one place. It covers every path that demotes or
-- deletes an Owner row (role changes, removal, leaving). It is skipped when the
-- Group or the person's profile is already gone: deleting a Group or an account
-- cascades to its members and must not be blocked.
------------------------------------------------------------------------------

create function public.group_members_guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only an Owner row going away or being demoted matters.
  if old.role = 'owner' and (tg_op = 'DELETE' or new.role <> 'owner') then
    if tg_op = 'DELETE' and (
      not exists (select 1 from public.groups g where g.id = old.group_id)
      or not exists (select 1 from public.profiles p where p.id = old.user_id)
    ) then
      return old;
    end if;

    -- Serialise changes to one Group's Owners, so two Owners cannot demote each
    -- other at the same moment and leave none.
    perform pg_advisory_xact_lock(hashtext('group_owners:' || old.group_id::text));
    if not exists (
      select 1 from public.group_members gm
      where gm.group_id = old.group_id
        and gm.role = 'owner'
        and gm.user_id <> old.user_id
    ) then
      raise exception 'A group needs at least one owner. Promote another member to owner first.'
        using errcode = '23514';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger group_members_guard_last_owner
  before update of role or delete on public.group_members
  for each row execute function public.group_members_guard_last_owner();

------------------------------------------------------------------------------
-- Sets someone added stay in the Group, and they lose access to them. Adding a
-- Set gives its adder a per-Set Owner row (sets_after_insert); without this,
-- that row would keep their access after they left or were removed. Other
-- people's per-Set roles are untouched, and so are Sets the person added
-- outside this Group.
------------------------------------------------------------------------------

create function public.group_members_drop_adder_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.groups g where g.id = old.group_id)
     and exists (select 1 from public.profiles p where p.id = old.user_id) then
    delete from public.set_members m
    using public.sets s
    where s.id = m.set_id
      and s.group_id = old.group_id
      and s.owner_id = old.user_id
      and m.user_id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger group_members_drop_adder_access
  after delete on public.group_members
  for each row execute function public.group_members_drop_adder_access();

------------------------------------------------------------------------------
-- A Set's adder keeps reading its row only while they can still reach it. The
-- read rule has `owner_id = me` so that insert ... returning works before the
-- after-insert trigger has added the Owner row. For a Set in a Group, that now
-- also requires that I am still in the Group.
------------------------------------------------------------------------------

drop policy "sets: read as member" on public.sets;
create policy "sets: read as member" on public.sets
  for select to authenticated
  using (
    (
      owner_id = (select auth.uid())
      and (group_id is null or public.group_role_of(group_id) is not null)
    )
    or id in (select public.my_set_ids())
  );

------------------------------------------------------------------------------
-- Deleting an account removes its memberships; recording that as a removal would
-- point at a profile that is already gone. Skip it then.
------------------------------------------------------------------------------

create or replace function public.record_group_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Not when leaving on your own, and not when the whole Group or the account
  -- is being deleted.
  if old.user_id is distinct from (select auth.uid())
     and exists (select 1 from public.groups where id = old.group_id)
     and exists (select 1 from public.profiles where id = old.user_id) then
    insert into public.group_removals (group_id, user_id)
    values (old.group_id, old.user_id)
    on conflict (group_id, user_id) do update set removed_at = now();
  end if;
  return null;
end;
$$;

------------------------------------------------------------------------------
-- Function privileges
------------------------------------------------------------------------------

revoke execute on function
  public.group_members_guard_last_owner(),
  public.group_members_drop_adder_access()
from public, anon, authenticated;
