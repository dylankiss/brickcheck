-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(4);

select has_index('public', 'set_progress', 'set_progress_line_id_idx', 'set_progress.line_id is indexed');
select has_index('public', 'set_invites', 'set_invites_created_by_idx', 'set_invites.created_by is indexed');
select has_index('public', 'set_removals', 'set_removals_user_id_idx', 'set_removals.user_id is indexed');

-- The next claim removes import log rows older than a week.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', 'authenticated', 'authenticated');
insert into public.set_import_log (user_id, set_num, created_at) values
  ('00000000-0000-0000-0000-00000000000a', 'told-1', now() - interval '8 days');
-- In a DO block: a bare select would print "ok", which TAP reads as a result.
do $$
begin
  perform public.claim_import('00000000-0000-0000-0000-00000000000a', 'tnew-1', 30);
end;
$$;
select is(
  (select count(*) from public.set_import_log where set_num = 'told-1'),
  0::bigint,
  'import log rows older than a week are pruned by the next claim'
);

select * from finish();
rollback;
