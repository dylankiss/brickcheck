-- Run with: npx supabase test db
-- Groups 3: putting Sets into and out of a Group (move_set_to_group).
begin;
create extension if not exists pgtap with schema extensions;

select plan(32);

------------------------------------------------------------------------------
-- Fixtures
--   Alice (a) owns the Sets. Group G1 "Family": Alice Owner (creator), Bob (b)
--   Helper, Carol (c) Viewer, Erin (e) Owner, Frank (f) Viewer.
--   G2: Erin creates it; Alice is a Helper. G3: Erin creates it; Alice is a
--   Viewer. G4: Erin creates it; Alice is not in it. Dave (d) is a stranger.
--   Sets of Alice: s1..s5 (all private to start with). Bob is a per-Set Helper
--   of s4, Frank a per-Set Helper of s2, Dave a per-Set Viewer of s1.
--   Erin (e) is a per-Set Viewer of s5.
------------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'frank@example.com', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "tm-1", "name": "Move set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 3}]'
);

create temporary table ctx (
  g1 uuid, g2 uuid, g3 uuid, g4 uuid, s1 uuid, s2 uuid, s3 uuid, s4 uuid, s5 uuid
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
update ctx set g1 = public.create_group('Family');
select pg_temp.login('e');
update ctx set g2 = public.create_group('Second');
update ctx set g3 = public.create_group('Third');
update ctx set g4 = public.create_group('Fourth');

reset role;
insert into public.group_members (group_id, user_id, role)
select g1, u.id, u.role::public.set_role
from ctx, (values
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'helper'),
  ('00000000-0000-0000-0000-00000000000c'::uuid, 'viewer'),
  ('00000000-0000-0000-0000-00000000000e'::uuid, 'owner'),
  ('00000000-0000-0000-0000-00000000000f'::uuid, 'viewer')
) as u (id, role)
union all
select g2, '00000000-0000-0000-0000-00000000000a'::uuid, 'helper'::public.set_role from ctx
union all
select g3, '00000000-0000-0000-0000-00000000000a'::uuid, 'viewer'::public.set_role from ctx;
set local role authenticated;

select pg_temp.login('a');
with c as (
  insert into public.sets (set_num, title)
  select 'tm-1', 'Set ' || i from generate_series(1, 5) as i returning id, title
)
update ctx set
  s1 = (select id from c where title = 'Set 1'),
  s2 = (select id from c where title = 'Set 2'),
  s3 = (select id from c where title = 'Set 3'),
  s4 = (select id from c where title = 'Set 4'),
  s5 = (select id from c where title = 'Set 5');

reset role;
insert into public.set_members (set_id, user_id, role)
select s1, '00000000-0000-0000-0000-00000000000d'::uuid, 'viewer'::public.set_role from ctx
union all
select s2, '00000000-0000-0000-0000-00000000000f'::uuid, 'helper'::public.set_role from ctx
union all
select s4, '00000000-0000-0000-0000-00000000000b'::uuid, 'helper'::public.set_role from ctx
union all
select s5, '00000000-0000-0000-0000-00000000000e'::uuid, 'viewer'::public.set_role from ctx;
set local role authenticated;

------------------------------------------------------------------------------
-- Moving in: only a Set's Owner, only into a Group where they are Owner/Helper
------------------------------------------------------------------------------

select pg_temp.login('b');
select throws_ok(
  $$ select public.move_set_to_group((select s4 from ctx), (select g1 from ctx)) $$,
  '42501',
  null,
  'a per-Set Helper cannot move a Set into a Group, even one they are in'
);

select pg_temp.login('d');
select throws_ok(
  $$ select public.move_set_to_group((select s1 from ctx), (select g1 from ctx)) $$,
  '42501',
  null,
  'a per-Set Viewer who is not in the Group cannot move the Set into it'
);

select pg_temp.login('a');
select throws_ok(
  $$ select public.move_set_to_group((select s3 from ctx), (select g3 from ctx)) $$,
  '42501',
  null,
  'the Owner cannot move a Set into a Group where they are only a Viewer'
);
select throws_ok(
  $$ select public.move_set_to_group((select s3 from ctx), (select g4 from ctx)) $$,
  '42501',
  null,
  'the Owner cannot move a Set into a Group they are not in'
);
select throws_ok(
  $$ select public.move_set_to_group((select s3 from ctx), gen_random_uuid()) $$,
  '42501',
  null,
  'moving a Set into a Group that does not exist is refused'
);
select is(
  (select group_id from public.sets where id = (select s3 from ctx)),
  null,
  'refused moves leave the Set private'
);

select lives_ok(
  $$ select public.move_set_to_group((select s1 from ctx), (select g1 from ctx)) $$,
  'the Owner can move a Set into a Group they Own'
);
select lives_ok(
  $$ select public.move_set_to_group((select s2 from ctx), (select g2 from ctx)) $$,
  'the Owner can move a Set into a Group where they are a Helper'
);
select is(
  (select group_id from public.set_summaries where id = (select s1 from ctx)),
  (select g1 from ctx),
  'the summary shows the Set''s Group after the move'
);
select throws_ok(
  $$ select public.move_set_to_group((select s1 from ctx), (select g2 from ctx)) $$,
  '55000',
  null,
  'a Set in a Group must be moved out before it can go into another'
);
select throws_ok(
  $$ update public.sets set group_id = null where id = (select s1 from ctx) $$,
  '42501',
  null,
  'group_id cannot be changed with a plain update'
);

-- Access follows at once, and per-Set roles stay
select pg_temp.login('c');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'viewer',
  'a Group Viewer sees the moved-in Set with their Group role'
);
select is(
  (select count(*)::int from public.set_lines where set_id = (select s1 from ctx)),
  1,
  'a Group member can read the moved-in Set''s parts (Missing across sets)'
);
select pg_temp.login('d');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'viewer',
  'a per-Set member keeps their role when the Set moves into a Group'
);
select pg_temp.login('f');
select is(
  (select my_role::text from public.set_summaries where id = (select s2 from ctx)),
  'helper',
  'a per-Set Helper keeps their role when the Set moves into a Group'
);

------------------------------------------------------------------------------
-- Moving out: the Set's Owner or a Group Owner; others are denied
------------------------------------------------------------------------------

select pg_temp.login('b');
select throws_ok(
  $$ select public.move_set_to_group((select s1 from ctx), null) $$,
  '42501',
  null,
  'a Group Helper cannot move a Set out of the Group'
);
select pg_temp.login('c');
select throws_ok(
  $$ select public.move_set_to_group((select s1 from ctx), null) $$,
  '42501',
  null,
  'a Group Viewer cannot move a Set out of the Group'
);
select pg_temp.login('d');
select throws_ok(
  $$ select public.move_set_to_group((select s1 from ctx), null) $$,
  '42501',
  null,
  'a per-Set Viewer cannot move a Set out of the Group'
);

select pg_temp.login('e');
select is(
  (select count(*)::int from public.set_members
   where set_id = (select s1 from ctx) and user_id = '00000000-0000-0000-0000-00000000000e'),
  0,
  'a Group Owner has no per-Set row before moving the Set out'
);
select lives_ok(
  $$ select public.move_set_to_group((select s1 from ctx), null) $$,
  'a Group Owner can move a Set out of the Group'
);
select is(
  (select role::text from public.set_members
   where set_id = (select s1 from ctx) and user_id = '00000000-0000-0000-0000-00000000000e'),
  'owner',
  'the Group Owner who moved it out becomes the Set''s Owner'
);
select is(
  (select group_id from public.sets where id = (select s1 from ctx)),
  null,
  'the Set is no longer in a Group'
);

-- Group-only access ends; per-Set roles stay
select pg_temp.login('c');
select is(
  (select count(*)::int from public.sets where id = (select s1 from ctx)),
  0,
  'a person with access only through the Group loses it'
);
select is(
  (select count(*)::int from public.set_lines where set_id = (select s1 from ctx)),
  0,
  'and can no longer read the Set''s parts'
);
select ok(
  not public.is_set_member(public.set_id_from_topic('set:' || (select s1 from ctx))),
  'and can no longer join the Set''s channel'
);
select pg_temp.login('d');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'viewer',
  'a per-Set member keeps their role when the Set moves out'
);
select pg_temp.login('a');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'owner',
  'the person who added the Set is still its Owner'
);

-- A Group Owner with a lower per-Set role is raised to Owner on moving out
select public.move_set_to_group((select s5 from ctx), (select g1 from ctx));
select pg_temp.login('e');
select public.move_set_to_group((select s5 from ctx), null);
select is(
  (select role::text from public.set_members
   where set_id = (select s5 from ctx) and user_id = '00000000-0000-0000-0000-00000000000e'),
  'owner',
  'a Group Owner who was a per-Set Viewer becomes an Owner on moving the Set out'
);

-- The Set's own Owner can move it out of a Group where they are only a Helper
select pg_temp.login('a');
select lives_ok(
  $$ select public.move_set_to_group((select s2 from ctx), null) $$,
  'the Set''s Owner can move it out of a Group they are only a Helper in'
);
select is(
  (select count(*)::int from public.set_members
   where set_id = (select s2 from ctx) and user_id = '00000000-0000-0000-0000-00000000000a' and role = 'owner'),
  1,
  'the Set''s Owner stays its Owner'
);
select lives_ok(
  $$ select public.move_set_to_group((select s2 from ctx), null) $$,
  'moving out a Set that is in no Group does nothing'
);

------------------------------------------------------------------------------
-- Nobody signed out can move Sets
------------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.move_set_to_group(gen_random_uuid(), null) $$,
  '42501',
  null,
  'anon cannot move Sets'
);

select * from finish();
rollback;
