-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name": "Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "t1-1", "name": "Test set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 2}]'
);

create temporary table ctx (check_id uuid, helper_token uuid, viewer_token uuid, expired_token uuid);
insert into ctx values (null, null, null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

set local role authenticated;
select pg_temp.login('a');
with c as (insert into public.checks (set_num, title) values ('t1-1', 'Shared castle') returning id)
update ctx set check_id = (select id from c);
with i as (insert into public.check_invites (check_id, role) select check_id, 'helper' from ctx returning token)
update ctx set helper_token = (select token from i);
with i as (insert into public.check_invites (check_id, role) select check_id, 'viewer' from ctx returning token)
update ctx set viewer_token = (select token from i);

reset role;
with i as (
  insert into public.check_invites (check_id, created_by, created_at, expires_at)
  select check_id, '00000000-0000-0000-0000-00000000000a', now() - interval '10 days', now() - interval '1 day' from ctx
  returning token
)
update ctx set expired_token = (select token from i);
set local role authenticated;

-- Bob previews and accepts the helper invite
select pg_temp.login('b');
select results_eq(
  $$ select check_title, set_name, role::text, invited_by, already_member
     from public.invite_preview((select helper_token from ctx)) $$,
  $$ values ('Shared castle', 'Test set', 'helper', 'Alice', false) $$,
  'a valid invite can be previewed before joining'
);
select is(
  (select count(*)::int from public.invite_preview((select expired_token from ctx))),
  0,
  'expired invites have no preview'
);
select is(
  (select public.accept_invite(helper_token) from ctx),
  (select check_id from ctx),
  'accepting returns the check id'
);
select is(
  (select role::text from public.check_members where user_id = '00000000-0000-0000-0000-00000000000b'),
  'helper',
  'the invitee becomes a member with the invite role'
);
select is((select count(*)::int from public.checks), 1, 'the invitee now sees the check');
select is(
  (select already_member from public.invite_preview((select viewer_token from ctx))),
  true,
  'the preview says when you are already a member'
);
select lives_ok(
  $$ select public.accept_invite(viewer_token) from ctx $$,
  'accepting again is harmless'
);
select is(
  (select role::text from public.check_members where user_id = '00000000-0000-0000-0000-00000000000b'),
  'helper',
  'a viewer invite never downgrades an existing member'
);

-- The owner keeps their role when opening their own invite
select pg_temp.login('a');
select public.accept_invite(viewer_token) from ctx;
select is(
  (select role::text from public.check_members where user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner',
  'the owner stays owner'
);

-- Carol tries an expired and a made-up token
select pg_temp.login('c');
select throws_ok(
  $$ select public.accept_invite(expired_token) from ctx $$,
  'P0002',
  null,
  'expired invites are rejected'
);
select throws_ok(
  $$ select public.accept_invite(gen_random_uuid()) $$,
  'P0002',
  null,
  'unknown tokens are rejected'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.accept_invite(gen_random_uuid()) $$,
  '42501',
  null,
  'anon cannot accept invites'
);

select * from finish();
rollback;
