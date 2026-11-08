-- Groups 5: leaving and deleting a Group. See ARCHITECTURE.md ("Data model",
-- "Security rules", "Invites") and docs/adr/0001-group-access-is-derived.md.
--
-- Leaving is a plain delete of your own membership. The rules that matter run
-- in triggers from 20261109030000 and apply to every path: the last Owner cannot
-- go (group_members_guard_last_owner), and Sets someone added stay in the Group
-- while they lose access (group_members_drop_adder_access). Leaving on your own
-- is not recorded as a removal (record_group_removal skips auth.uid() = the
-- person), so an older Group invite still works for them. Refreshing open pages
-- is group_change_broadcast, as for any membership change.

------------------------------------------------------------------------------
-- Leaving: any member deletes their own row
------------------------------------------------------------------------------

create policy "group_members: leave" on public.group_members
  for delete to authenticated
  using (user_id = (select auth.uid()));

------------------------------------------------------------------------------
-- Deleting a Group: Owners only, and only when it has no Sets. The trigger gives
-- a clear error before the `on delete restrict` foreign key on sets.group_id
-- would raise a raw violation. Deleting cascades to members, invites and
-- removals; the last-Owner rule and the removal record skip a Group that is
-- already gone.
------------------------------------------------------------------------------

create policy "groups: owner deletes" on public.groups
  for delete to authenticated
  using (public.is_group_owner(id));

grant delete on public.groups to authenticated;

create function public.groups_before_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- security definer, so Sets the deleting Owner cannot read still count.
  if exists (select 1 from public.sets s where s.group_id = old.id) then
    raise exception 'A group with sets cannot be deleted. Move or delete its sets first.'
      using errcode = '55000';
  end if;
  return old;
end;
$$;

create trigger groups_before_delete
  before delete on public.groups
  for each row execute function public.groups_before_delete();

revoke execute on function public.groups_before_delete()
from public, anon, authenticated;
