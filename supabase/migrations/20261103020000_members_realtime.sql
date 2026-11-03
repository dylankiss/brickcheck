-- Phase 2: membership changes reach open pages, and a global cap on imports.

------------------------------------------------------------------------------
-- Changes to a set or its members are broadcast on the set's channel, so
-- open pages refresh (a removed member's page then finds no set and stops).
------------------------------------------------------------------------------

create function public.set_change_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_set_id uuid;
begin
  if tg_table_name = 'sets' then
    v_set_id := coalesce(new.id, old.id);
  else
    v_set_id := coalesce(new.set_id, old.set_id);
  end if;
  perform realtime.send(
    jsonb_build_object('table', tg_table_name, 'op', tg_op),
    'changed',
    'set:' || v_set_id::text,
    true
  );
  return null;
end;
$$;

create trigger set_members_broadcast
  after insert or update or delete on public.set_members
  for each row execute function public.set_change_broadcast();

create trigger sets_broadcast
  after update on public.sets
  for each row execute function public.set_change_broadcast();

revoke execute on function public.set_change_broadcast() from public, anon, authenticated;

------------------------------------------------------------------------------
-- claim_import: add a global hourly cap so the shared Rebrickable key cannot
-- be drained by many fresh accounts. Returns 'ok', 'rate_limited',
-- 'in_progress' or 'busy'.
------------------------------------------------------------------------------

create or replace function public.claim_import(p_user_id uuid, p_set_num text, p_per_hour int)
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

  if (
    select count(*) from public.set_import_log
    where created_at > now() - interval '1 hour'
  ) >= 200 then
    return 'busy';
  end if;

  insert into public.set_import_log (user_id, set_num) values (p_user_id, p_set_num);
  return 'ok';
end;
$$;

create index set_import_log_created_idx on public.set_import_log (created_at);
