-- Explicit service_role grants for the import path, and releasing failed import claims.

------------------------------------------------------------------------------
-- The fetch-set function and the catalog script write the set cache with the
-- service role. Grant that explicitly, like the authenticated grants.
------------------------------------------------------------------------------

grant usage on schema public to service_role;
grant select, insert, update on public.lego_sets to service_role;
grant select, insert on public.set_parts to service_role;
grant select, insert, update on public.set_import_log to service_role;
grant usage, select on all sequences in schema public to service_role;

------------------------------------------------------------------------------
-- A failed import (Rebrickable down, bad key, timeout) releases its claim, so
-- a retry doesn't get "being imported right now" for 3 minutes. Failed rows
-- still count towards the hourly limits.
------------------------------------------------------------------------------

alter table public.set_import_log add column failed_at timestamptz;

create function public.release_import(p_user_id uuid, p_set_num text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.set_import_log
  set failed_at = now()
  where id = (
    select id from public.set_import_log
    where user_id = p_user_id and set_num = p_set_num and failed_at is null
    order by created_at desc
    limit 1
  );
$$;

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
    where set_num = p_set_num
      and failed_at is null
      and created_at > now() - interval '3 minutes'
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

revoke execute on function public.release_import(uuid, text) from public, anon, authenticated;
grant execute on function public.release_import(uuid, text) to service_role;
