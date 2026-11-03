-- Phase 2: joining a check through an invite link. See ARCHITECTURE.md, "Invites".

-- What a valid invite leads to, so the join page can show it before accepting.
-- Returns no row for unknown or expired tokens.
create function public.invite_preview(p_token uuid)
returns table (
  check_id uuid,
  check_title text,
  set_num text,
  set_name text,
  set_img_url text,
  role public.check_role,
  invited_by text,
  already_member boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.title,
    s.set_num,
    s.name,
    s.img_url,
    i.role,
    p.display_name,
    public.is_check_member(c.id)
  from public.check_invites i
  join public.checks c on c.id = i.check_id
  join public.lego_sets s on s.set_num = c.set_num
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token
    and i.expires_at > now();
$$;

-- Adds the current user to the invite's check. Never changes the role of an
-- existing member (no downgrade, no upgrade) and never grants owner.
-- Returns the check id.
create function public.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_check_id uuid;
  v_role public.check_role;
begin
  if v_user_id is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  select i.check_id, i.role into v_check_id, v_role
  from public.check_invites i
  where i.token = p_token
    and i.expires_at > now();

  if v_check_id is null then
    raise exception 'This invite link is invalid or has expired' using errcode = 'P0002';
  end if;

  insert into public.check_members (check_id, user_id, role)
  values (v_check_id, v_user_id, v_role)
  on conflict (check_id, user_id) do nothing;

  return v_check_id;
end;
$$;

revoke execute on function
  public.invite_preview(uuid),
  public.accept_invite(uuid)
from public, anon;
