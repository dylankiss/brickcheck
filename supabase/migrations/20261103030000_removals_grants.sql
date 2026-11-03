-- Removed members can't rejoin with an old link; explicit grants; avatar hardening.

------------------------------------------------------------------------------
-- Removals: when the owner removes someone, links created before that no
-- longer work for them. A new link (created after the removal) does, so the
-- owner can still invite them back. Leaving on your own is not recorded.
------------------------------------------------------------------------------

create table public.set_removals (
  set_id uuid not null references public.sets (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  removed_at timestamptz not null default now(),
  primary key (set_id, user_id)
);

alter table public.set_removals enable row level security;
-- Only read and written by the security definer functions below.
revoke all on public.set_removals from anon, authenticated;

create function public.record_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Not when leaving on your own, and not when the whole set is being deleted.
  if old.user_id is distinct from (select auth.uid())
     and exists (select 1 from public.sets where id = old.set_id) then
    insert into public.set_removals (set_id, user_id)
    values (old.set_id, old.user_id)
    on conflict (set_id, user_id) do update set removed_at = now();
  end if;
  return null;
end;
$$;

create trigger set_members_record_removal
  after delete on public.set_members
  for each row execute function public.record_removal();

revoke execute on function public.record_removal() from public, anon, authenticated;

create or replace function public.accept_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_set_id uuid;
  v_role public.set_role;
  v_created_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not logged in' using errcode = '42501';
  end if;

  select i.set_id, i.role, i.created_at into v_set_id, v_role, v_created_at
  from public.set_invites i
  where i.token = p_token
    and i.expires_at > now();

  if v_set_id is null then
    raise exception 'This invite link is invalid or has expired' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.set_removals r
    where r.set_id = v_set_id and r.user_id = v_user_id and r.removed_at >= v_created_at
  ) then
    raise exception 'This invite link is invalid or has expired' using errcode = 'P0002';
  end if;

  insert into public.set_members (set_id, user_id, role)
  values (v_set_id, v_user_id, v_role)
  on conflict (set_id, user_id) do nothing;

  -- Let back in by the owner (with a newer link): the removal no longer applies.
  delete from public.set_removals where set_id = v_set_id and user_id = v_user_id;

  return v_set_id;
end;
$$;

-- The preview follows the same rule, so a removed member sees "invalid link".
create or replace function public.invite_preview(p_token uuid)
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
    and i.expires_at > now()
    and not exists (
      select 1 from public.set_removals r
      where r.set_id = i.set_id
        and r.user_id = (select auth.uid())
        and r.removed_at >= i.created_at
    );
$$;

------------------------------------------------------------------------------
-- avatar_url comes from the OAuth provider (signup trigger) only: a
-- user-chosen URL would let a member log co-members' IP addresses.
------------------------------------------------------------------------------

revoke update (avatar_url) on public.profiles from authenticated;

------------------------------------------------------------------------------
-- Explicit grants for what the app uses, instead of relying on the
-- platform's default privileges (which hosted projects may not apply).
------------------------------------------------------------------------------

grant usage on schema public to authenticated;

grant select on
  public.profiles,
  public.lego_sets,
  public.inventory_lines,
  public.sets,
  public.set_members,
  public.set_progress,
  public.set_invites,
  public.set_lines,
  public.set_summaries
to authenticated;

grant insert, delete on public.sets to authenticated;
grant update (title) on public.sets to authenticated;
grant delete on public.set_members to authenticated;
grant update (role) on public.set_members to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant insert (set_id, role, expires_at), delete on public.set_invites to authenticated;

grant execute on function
  public.adjust_part(uuid, text, int, int),
  public.invite_preview(uuid),
  public.accept_invite(uuid),
  public.my_set_ids(),
  public.set_role_of(uuid),
  public.is_set_member(uuid),
  public.is_set_helper(uuid),
  public.is_set_owner(uuid),
  public.shares_set_with(uuid),
  public.line_counts(boolean, boolean, boolean, text),
  public.set_id_from_topic(text)
to authenticated;
