-- Indexes for foreign keys that had none (Supabase advisor lint 0001): they speed
-- up the cascading deletes behind a removed member, a deleted set or a deleted user.
-- set_progress and set_removals have composite primary keys that start with set_id,
-- so line_id and user_id on their own were not covered.
create index set_progress_line_id_idx on public.set_progress (line_id);
create index set_invites_created_by_idx on public.set_invites (created_by);
create index set_removals_user_id_idx on public.set_removals (user_id);

-- claim_import now also prunes the import log. Its longest window is one hour, so
-- rows older than a week only take up space. Otherwise the same as before.
create or replace function public.claim_import(p_user_id uuid, p_set_num text, p_per_hour int)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('claim_import'));

  delete from public.set_import_log where created_at < now() - interval '7 days';

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
