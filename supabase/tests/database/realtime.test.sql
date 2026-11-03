-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select has_trigger('public', 'set_progress', 'set_progress_broadcast', 'progress changes are broadcast');
select has_trigger('public', 'set_members', 'set_members_broadcast', 'membership changes are broadcast');
select has_trigger('public', 'sets', 'sets_broadcast', 'set changes are broadcast');

-- The global cap: fill the last hour with 200 imports by other users.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', 'authenticated', 'authenticated');
insert into public.set_import_log (user_id, set_num, created_at)
select '00000000-0000-0000-0000-00000000000b', 'tcap-' || i, now() - interval '10 minutes'
from generate_series(1, 200) as i;

select is(
  public.claim_import('00000000-0000-0000-0000-00000000000a', 'tcap-new', 30),
  'busy',
  'imports stop once the global hourly cap is reached'
);

-- A failed import releases its claim for the set but still counts.
delete from public.set_import_log;
-- In a DO block: a bare select would print "ok", which TAP reads as a result.
do $$
begin
  perform public.claim_import('00000000-0000-0000-0000-00000000000a', 'tfail-1', 2);
  perform public.release_import('00000000-0000-0000-0000-00000000000a', 'tfail-1');
end;
$$;
select is(
  public.claim_import('00000000-0000-0000-0000-00000000000a', 'tfail-1', 2),
  'ok',
  'a released (failed) import can be retried at once'
);
select is(
  public.claim_import('00000000-0000-0000-0000-00000000000a', 'tfail-2', 2),
  'rate_limited',
  'failed imports still count towards the hourly limit'
);

select * from finish();
rollback;
