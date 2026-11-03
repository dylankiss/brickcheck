-- Phase 2: joining a set through an invite link. See ARCHITECTURE.md, "Invites".

-- What a valid invite leads to, so the join page can show it before accepting.
-- Returns no row for unknown or expired tokens.
create function public.invite_preview(p_token uuid)
returns table (
  set_id uuid,
  set_title text,
  set_num text,
  catalog_name text,
  catalog_img_url text,
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
    c.id,
    c.title,
    s.set_num,
    s.name,
    s.img_url,
    i.role,
    p.display_name,
    public.is_set_member(c.id)
  from public.set_invites i
  join public.sets c on c.id = i.set_id
  join public.lego_sets s on s.set_num = c.set_num
  left join public.profiles p on p.id = i.created_by
  where i.token = p_token
    and i.expires_at > now();
$$;

-- Adds the current user to the invite's set. Never changes the role of an
-- existing member (no downgrade, no upgrade) and never grants owner.
-- Returns the set id.
create function public.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_set_id uuid;
  v_role public.set_role;
begin
  if v_user_id is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  select i.set_id, i.role into v_set_id, v_role
  from public.set_invites i
  where i.token = p_token
    and i.expires_at > now();

  if v_set_id is null then
    raise exception 'This invite link is invalid or has expired' using errcode = 'P0002';
  end if;

  insert into public.set_members (set_id, user_id, role)
  values (v_set_id, v_user_id, v_role)
  on conflict (set_id, user_id) do nothing;

  return v_set_id;
end;
$$;

revoke execute on function
  public.invite_preview(uuid),
  public.accept_invite(uuid)
from public, anon;
