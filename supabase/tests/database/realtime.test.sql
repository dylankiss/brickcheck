-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

select has_trigger('public', 'check_progress', 'check_progress_broadcast', 'progress changes are broadcast');
select has_trigger('public', 'check_members', 'check_members_broadcast', 'membership changes are broadcast');
select has_trigger('public', 'checks', 'checks_broadcast', 'check changes are broadcast');

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

select * from finish();
rollback;
