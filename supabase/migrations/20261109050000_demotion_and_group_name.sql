-- Groups review fixes. See ARCHITECTURE.md ("Data model", "Security rules").
--
-- 1. Demoting a Group member must not leave them with more rights than the new
--    role allows. Adding a Set gives its adder a per-Set Owner row
--    (sets_after_insert), and set_role_of takes the highest of that row and the
--    Group role, so a Helper demoted to Viewer would still delete or reset the
--    Sets they added. Smallest rule: when a Group role is lowered, lower the
--    person's per-Set role on the Sets they added in this Group to the same role.
--    Their rows on other people's Sets, and on Sets they added outside the Group,
--    are not touched. Raising a role does not restore anything.
-- 2. A Group name is stored trimmed on update too (create_group already does it).

create function public.group_members_lower_adder_access()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The enum is declared owner, helper, viewer: a bigger value is a lower role.
  if new.role > old.role then
    update public.set_members m
    set role = new.role
    from public.sets s
    where s.id = m.set_id
      and s.group_id = new.group_id
      and s.owner_id = new.user_id
      and m.user_id = new.user_id
      and m.role < new.role;
  end if;
  return null;
end;
$$;

create trigger group_members_lower_adder_access
  after update of role on public.group_members
  for each row execute function public.group_members_lower_adder_access();

create function public.groups_trim_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := btrim(new.name);
  return new;
end;
$$;

create trigger groups_trim_name
  before update of name on public.groups
  for each row execute function public.groups_trim_name();

revoke execute on function
  public.group_members_lower_adder_access(),
  public.groups_trim_name()
from public, anon, authenticated;
