-- Groups 3: put Sets into and out of a Group. See ARCHITECTURE.md ("Data flow",
-- "Data model", "Security rules") and docs/adr/0001-group-access-is-derived.md.
--
-- sets.group_id has no update grant, so this function is the only way to change
-- it. Access is derived (ADR 0001): moving a Set copies nothing into
-- set_members, except that whoever moves a Set out becomes its Owner. The update
-- fires the sets_broadcast trigger, which sends the usual `changed` broadcast on
-- the Set's channel, and the member change fires set_members_broadcast.

create function public.move_set_to_group(p_set_id uuid, p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current uuid;
begin
  if v_user_id is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  -- Lock the Set, so two moves of the same Set cannot interleave.
  select s.group_id into v_current
  from public.sets s
  where s.id = p_set_id
  for update;

  -- Not found and not allowed look the same, so Set ids cannot be probed.
  -- The effective role: the Set's Owner, or an Owner of its Group.
  if not found or not public.is_set_owner(p_set_id) then
    raise exception 'Only an owner of the set can move it' using errcode = '42501';
  end if;

  if p_group_id is null then
    -- Moving out. Nothing to do for a Set that is in no Group.
    if v_current is null then
      return;
    end if;

    -- Whoever moves it out is its Owner afterwards (a Group Owner had that role
    -- only through the Group). Other per-Set members keep their roles.
    insert into public.set_members (set_id, user_id, role)
    values (p_set_id, v_user_id, 'owner')
    on conflict (set_id, user_id) do update set role = 'owner'
    where public.set_members.role <> 'owner';
  else
    -- Moving in: only into a Group where the caller is an Owner or Helper.
    if coalesce(public.group_role_of(p_group_id) in ('owner', 'helper'), false) is not true then
      raise exception 'Only an owner or helper of the group can add sets to it'
        using errcode = '42501';
    end if;
    -- Moving straight from one Group to another is not allowed: move out first.
    if v_current is not null then
      raise exception 'The set is already in a group; move it out first'
        using errcode = '55000';
    end if;
  end if;

  update public.sets set group_id = p_group_id where id = p_set_id;
end;
$$;

revoke execute on function public.move_set_to_group(uuid, uuid) from public, anon;
grant execute on function public.move_set_to_group(uuid, uuid) to authenticated;
