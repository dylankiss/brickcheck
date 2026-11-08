-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(48);

------------------------------------------------------------------------------
-- Fixtures
--   Alice (a) owns the Group "Family"; Bob (b) is a Helper, Carol (c) a Viewer.
--   Dave (d), Erin (e) and Frank (f) are strangers. G2 is a second Group, used
--   for the 20-member cap.
------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name": "Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'frank@example.com', '{}', 'authenticated', 'authenticated');

insert into auth.users (id, email, raw_user_meta_data, aud, role)
select
  ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
  'filler' || i || '@example.com', '{}', 'authenticated', 'authenticated'
from generate_series(1, 19) i;

select public.import_set(
  '{"set_num": "gi-1", "name": "Group invite set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 2}]'
);

create temporary table ctx (
  g uuid, g2 uuid, set_in_group uuid, private_set uuid,
  helper_token uuid, viewer_token uuid, expired_token uuid, g2_token uuid,
  messages_before int
);
insert into ctx values (null, null, null, null, null, null, null, null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

set local role authenticated;
select pg_temp.login('a');
update ctx set g = public.create_group('Family');

reset role;
insert into public.group_members (group_id, user_id, role)
select g, u.id, u.role::public.set_role
from ctx, (values
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'helper'),
  ('00000000-0000-0000-0000-00000000000c'::uuid, 'viewer')
) as u (id, role);
set local role authenticated;

select pg_temp.login('a');
with c as (
  insert into public.sets (set_num, title, group_id)
  select 'gi-1', 'Group set', g from ctx returning id
)
update ctx set set_in_group = (select id from c);
with c as (insert into public.sets (set_num, title) values ('gi-1', 'Private set') returning id)
update ctx set private_set = (select id from c);

------------------------------------------------------------------------------
-- Creating Group invites: Owners only
------------------------------------------------------------------------------

with i as (insert into public.group_invites (group_id, role) select g, 'helper' from ctx returning token)
update ctx set helper_token = (select token from i);
with i as (insert into public.group_invites (group_id, role) select g, 'viewer' from ctx returning token)
update ctx set viewer_token = (select token from i);

select is(
  (select count(*)::int from public.group_invites where group_id = (select g from ctx)),
  2,
  'an Owner can create and read Group invites'
);
select is(
  (select expires_at - created_at from public.group_invites where token = (select helper_token from ctx)),
  interval '7 days',
  'a Group invite expires in 7 days by default'
);
select is(
  (select created_by from public.group_invites where token = (select helper_token from ctx)),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'a Group invite records who created it'
);
select throws_ok(
  $$ insert into public.group_invites (group_id, role) select g, 'owner' from ctx $$,
  '23514',
  null,
  'a Group invite can never grant Owner'
);
select throws_ok(
  $$ insert into public.group_invites (group_id, role, expires_at)
     select g, 'viewer', now() + interval '31 days' from ctx $$,
  '23514',
  null,
  'a Group invite expires within 30 days'
);
select lives_ok(
  $$ insert into public.group_invites (group_id, role, expires_at)
     select g, 'viewer', now() + interval '30 days' from ctx $$,
  'a Group invite may last 30 days'
);

select pg_temp.login('b');
select is((select count(*)::int from public.group_invites), 0, 'a Helper cannot read Group invites');
select throws_ok(
  $$ insert into public.group_invites (group_id, role) select g, 'viewer' from ctx $$,
  '42501',
  null,
  'a Helper cannot create Group invites'
);

select pg_temp.login('c');
select is((select count(*)::int from public.group_invites), 0, 'a Viewer cannot read Group invites');
select throws_ok(
  $$ insert into public.group_invites (group_id, role) select g, 'viewer' from ctx $$,
  '42501',
  null,
  'a Viewer cannot create Group invites'
);

select pg_temp.login('d');
select is((select count(*)::int from public.group_invites), 0, 'a non-member cannot read Group invites');
select throws_ok(
  $$ insert into public.group_invites (group_id, role) select g, 'viewer' from ctx $$,
  '42501',
  null,
  'a non-member cannot create Group invites'
);

reset role;
with i as (
  insert into public.group_invites (group_id, created_by, created_at, expires_at)
  select g, '00000000-0000-0000-0000-00000000000a', now() - interval '10 days', now() - interval '1 day' from ctx
  returning token
)
update ctx set expired_token = (select token from i);
update ctx set messages_before = (
  select count(*)::int from realtime.messages
  where topic = 'set:' || set_in_group::text and event = 'changed'
);
set local role authenticated;

------------------------------------------------------------------------------
-- Preview and accept
------------------------------------------------------------------------------

select pg_temp.login('e');
select results_eq(
  $$ select group_name, role::text, invited_by, already_member
     from public.group_invite_preview((select helper_token from ctx)) $$,
  $$ values ('Family', 'helper', 'Alice', false) $$,
  'a valid Group invite shows the Group name and the inviter before joining'
);
select is(
  (select count(*)::int from public.group_invite_preview((select expired_token from ctx))),
  0,
  'an expired Group invite has no preview'
);
select is(
  (select count(*)::int from public.group_invite_preview(gen_random_uuid())),
  0,
  'an unknown token has no preview'
);
select throws_ok(
  $$ select public.accept_group_invite(expired_token) from ctx $$,
  'P0002',
  null,
  'an expired Group invite is rejected'
);
select throws_ok(
  $$ select public.accept_group_invite(gen_random_uuid()) $$,
  'P0002',
  null,
  'an unknown Group invite token is rejected'
);
select is(
  (select public.accept_group_invite(helper_token) from ctx),
  (select g from ctx),
  'accepting returns the Group id'
);
select is(
  (select role::text from public.group_members
   where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000e'),
  'helper',
  'the invitee becomes a member with the invite role'
);
select is(
  (select count(*)::int from public.sets where id = (select set_in_group from ctx)),
  1,
  'the invitee can see the Group''s Sets'
);
select is(
  (select count(*)::int from public.sets where id = (select private_set from ctx)),
  0,
  'the invitee cannot see Sets outside the Group'
);
select is(
  (select already_member from public.group_invite_preview((select viewer_token from ctx))),
  true,
  'the preview says when you are already a member'
);

reset role;
select is(
  (select count(*)::int from realtime.messages
   where topic = 'set:' || (select set_in_group from ctx)::text and event = 'changed')
  - (select messages_before from ctx),
  1,
  'a new member is broadcast on the Group''s Set channel'
);
select is(
  (select count(*)::int from realtime.messages
   where topic = 'set:' || (select private_set from ctx)::text and event = 'changed'),
  0,
  'a Group change is not broadcast on a Set outside the Group'
);
set local role authenticated;

------------------------------------------------------------------------------
-- Existing members keep their role; Owner is never granted
------------------------------------------------------------------------------

select pg_temp.login('e');
select lives_ok(
  $$ select public.accept_group_invite(viewer_token) from ctx $$,
  'accepting a Group invite again is harmless'
);
select is(
  (select role::text from public.group_members
   where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000e'),
  'helper',
  'a viewer invite never downgrades a Helper'
);

select pg_temp.login('c');
select public.accept_group_invite(helper_token) from ctx;
select is(
  (select role::text from public.group_members
   where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000c'),
  'viewer',
  'a helper invite never upgrades a Viewer'
);

select pg_temp.login('a');
select public.accept_group_invite(viewer_token) from ctx;
select is(
  (select role::text from public.group_members
   where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner',
  'an Owner stays Owner when opening a Group invite'
);
select is(
  (select count(*)::int from public.group_members
   where group_id = (select g from ctx) and role = 'owner'),
  1,
  'no Group invite ever grants Owner'
);

------------------------------------------------------------------------------
-- Revoking
------------------------------------------------------------------------------

select pg_temp.login('b');
delete from public.group_invites where token = (select viewer_token from ctx);
select pg_temp.login('a');
select is(
  (select count(*)::int from public.group_invites where token = (select viewer_token from ctx)),
  1,
  'a Helper cannot revoke a Group invite'
);
delete from public.group_invites where token = (select viewer_token from ctx);
select is(
  (select count(*)::int from public.group_invites where token = (select viewer_token from ctx)),
  0,
  'an Owner can revoke a Group invite'
);

select pg_temp.login('f');
select throws_ok(
  $$ select public.accept_group_invite(viewer_token) from ctx $$,
  'P0002',
  null,
  'a revoked Group invite is rejected'
);
select is(
  (select count(*)::int from public.group_invite_preview((select viewer_token from ctx))),
  0,
  'a revoked Group invite has no preview'
);

------------------------------------------------------------------------------
-- Removal blocks older links; leaving does not
------------------------------------------------------------------------------

-- Alice, the Owner, removes Erin.
select pg_temp.login('a');
delete from public.group_members where user_id = '00000000-0000-0000-0000-00000000000e';

select pg_temp.login('e');
select throws_ok(
  $$ select public.accept_group_invite(helper_token) from ctx $$,
  'P0002',
  null,
  'a removed member cannot rejoin with an old Group invite'
);
select is(
  (select count(*)::int from public.group_invite_preview((select helper_token from ctx))),
  0,
  'a removed member sees no preview for an old Group invite'
);

reset role;
-- A link created after the removal (one second later) works again.
with i as (
  insert into public.group_invites (group_id, created_by, created_at)
  select g, '00000000-0000-0000-0000-00000000000a', now() + interval '1 second' from ctx
  returning token
)
update ctx set helper_token = (select token from i);
set local role authenticated;
select pg_temp.login('e');
select lives_ok(
  $$ select public.accept_group_invite(helper_token) from ctx $$,
  'a newer Group invite lets a removed member back in'
);
reset role;
select is(
  (select count(*)::int from public.group_removals where user_id = '00000000-0000-0000-0000-00000000000e'),
  0,
  'accepting a newer Group invite clears the removal'
);

-- Leaving on your own is not a removal.
delete from public.group_members where user_id = '00000000-0000-0000-0000-00000000000e';
select is(
  (select count(*)::int from public.group_removals where user_id = '00000000-0000-0000-0000-00000000000e'),
  0,
  'leaving on your own is not recorded as a removal'
);
set local role authenticated;
select lives_ok(
  $$ select public.accept_group_invite(helper_token) from ctx $$,
  'someone who left can rejoin with an old Group invite'
);

------------------------------------------------------------------------------
-- The 20-member cap (G2: Alice, Carol and 18 fillers = 20 members)
------------------------------------------------------------------------------

select pg_temp.login('a');
update ctx set g2 = public.create_group('Big');
with i as (insert into public.group_invites (group_id, role) select g2, 'viewer' from ctx returning token)
update ctx set g2_token = (select token from i);

reset role;
insert into public.group_members (group_id, user_id, role)
select g2, ('10000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'viewer'
from ctx, generate_series(1, 18) i;
insert into public.group_members (group_id, user_id, role)
select g2, '00000000-0000-0000-0000-00000000000c', 'viewer' from ctx;
select is(
  (select count(*)::int from public.group_members where group_id = (select g2 from ctx)),
  20,
  'the Group is at the 20-member cap'
);
select throws_ok(
  $$ insert into public.group_members (group_id, user_id, role)
     select g2, '10000000-0000-0000-0000-000000000019', 'viewer' from ctx $$,
  '54000',
  null,
  'a 21st member cannot be added'
);
set local role authenticated;

select pg_temp.login('d');
select throws_ok(
  $$ select public.accept_group_invite(g2_token) from ctx $$,
  '54000',
  null,
  'a Group invite cannot take a Group past 20 members'
);
select pg_temp.login('c');
select lives_ok(
  $$ select public.accept_group_invite(g2_token) from ctx $$,
  'a member of a full Group can still open its invite'
);

-- Alice, the Owner, removes a member to free a place.
select pg_temp.login('a');
delete from public.group_members
where group_id = (select g2 from ctx) and user_id = '10000000-0000-0000-0000-000000000001';
select pg_temp.login('d');
select lives_ok(
  $$ select public.accept_group_invite(g2_token) from ctx $$,
  'a freed place lets the next person in'
);

------------------------------------------------------------------------------
-- Not logged in, and grants
------------------------------------------------------------------------------

reset role;
select has_trigger('public', 'group_members', 'group_members_broadcast', 'Group membership changes are broadcast');
select ok(
  has_function_privilege('authenticated', 'public.accept_group_invite(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.group_invite_preview(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.accept_group_invite(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.group_invite_preview(uuid)', 'execute'),
  'only logged-in users can preview and accept Group invites'
);
select ok(
  not has_table_privilege('anon', 'public.group_invites', 'select')
  and not has_table_privilege('anon', 'public.group_removals', 'select')
  and not has_table_privilege('authenticated', 'public.group_removals', 'select'),
  'Group invites are closed to anon, and removals to everyone but the functions'
);

set local role anon;
select throws_ok(
  $$ select public.accept_group_invite(gen_random_uuid()) $$,
  '42501',
  null,
  'anon cannot accept Group invites'
);

select * from finish();
rollback;
