-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(50);

------------------------------------------------------------------------------
-- Fixtures
--   Alice (a) creates the Group "Family"; Bob (b) is a Helper, Carol (c) a
--   Viewer, Erin (e) a second Owner, Frank (f) a Viewer. Dave (d) is a stranger.
--   S1 is a Set of Alice's in the Group, S2 another one. P is Alice's private Set.
------------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'frank@example.com', 'authenticated', 'authenticated');

update public.profiles set display_name = 'Erin' where id = '00000000-0000-0000-0000-00000000000e';

select public.import_set(
  '{"set_num": "tg-1", "name": "Group set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 3, "element_id": "300121"}]'
);

create temporary table ctx (
  group_id uuid, g2_id uuid, s1 uuid, s2 uuid, bob_set uuid, p uuid
);
insert into ctx values (null, null, null, null, null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

set local role authenticated;
select pg_temp.login('a');

update ctx set group_id = public.create_group('Family');

select ok((select group_id from ctx) is not null, 'create_group returns the new Group');
select is(
  (select role::text from public.group_members
   where group_id = (select group_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000a'),
  'owner',
  'the creator is the Owner of the Group'
);

reset role;
insert into public.group_members (group_id, user_id, role)
select group_id, u.id, u.role::public.set_role
from ctx, (values
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'helper'),
  ('00000000-0000-0000-0000-00000000000c'::uuid, 'viewer'),
  ('00000000-0000-0000-0000-00000000000e'::uuid, 'owner'),
  ('00000000-0000-0000-0000-00000000000f'::uuid, 'viewer')
) as u (id, role);
set local role authenticated;

------------------------------------------------------------------------------
-- Non-members cannot read a Group or its members
------------------------------------------------------------------------------

select pg_temp.login('d');
select is((select count(*)::int from public.groups), 0, 'a stranger cannot read any Group');
select is((select count(*)::int from public.group_members), 0, 'a stranger cannot read any Group member');

select pg_temp.login('b');
select is(
  (select count(*)::int from public.groups where id = (select group_id from ctx)),
  1,
  'a member can read the Group'
);
select is(
  (select count(*)::int from public.group_members where group_id = (select group_id from ctx)),
  5,
  'a member can read every member of the Group'
);

------------------------------------------------------------------------------
-- Renaming and direct writes
------------------------------------------------------------------------------

select pg_temp.login('a');
update public.groups set name = 'Renamed' where id = (select group_id from ctx);
select is(
  (select name from public.groups where id = (select group_id from ctx)),
  'Renamed',
  'an Owner can rename the Group'
);

select throws_ok(
  $$ update public.groups set name = '   ' where id = (select group_id from ctx) $$,
  '23514',
  null,
  'a Group needs a name'
);

select pg_temp.login('b');
update public.groups set name = 'Hacked' where id = (select group_id from ctx);
select pg_temp.login('d');
update public.groups set name = 'Hacked' where id = (select group_id from ctx);
select pg_temp.login('a');
select is(
  (select name from public.groups where id = (select group_id from ctx)),
  'Renamed',
  'a Helper and a stranger cannot rename the Group'
);

select throws_ok(
  $$ insert into public.groups (name) values ('Sneaky') $$,
  '42501',
  null,
  'Groups are created through create_group only'
);

select pg_temp.login('b');
select throws_ok(
  $$ insert into public.group_members (group_id, user_id, role)
     values ((select group_id from ctx), '00000000-0000-0000-0000-00000000000d', 'viewer') $$,
  '42501',
  null,
  'members cannot add people to a Group directly'
);

------------------------------------------------------------------------------
-- Creating Sets in a Group
------------------------------------------------------------------------------

select pg_temp.login('a');
with c as (
  insert into public.sets (set_num, title, group_id)
  select 'tg-1', 'Group set', group_id from ctx returning id
)
update ctx set s1 = (select id from c);
with c as (
  insert into public.sets (set_num, title, group_id)
  select 'tg-1', 'Second group set', group_id from ctx returning id
)
update ctx set s2 = (select id from c);
with c as (insert into public.sets (set_num, title) values ('tg-1', 'Private') returning id)
update ctx set p = (select id from c);

select pg_temp.login('b');
select lives_ok(
  $$ with c as (
       insert into public.sets (set_num, title, group_id)
       select 'tg-1', 'Bob''s set', group_id from ctx returning id
     )
     update ctx set bob_set = (select id from c) $$,
  'a Helper can create a Set in the Group'
);

select pg_temp.login('c');
select throws_ok(
  $$ insert into public.sets (set_num, title, group_id)
     select 'tg-1', 'Carol''s set', group_id from ctx $$,
  '42501',
  null,
  'a Viewer cannot create a Set in the Group'
);

select pg_temp.login('d');
select throws_ok(
  $$ insert into public.sets (set_num, title, group_id)
     select 'tg-1', 'Dave''s set', group_id from ctx $$,
  '42501',
  null,
  'a stranger cannot create a Set in the Group'
);

-- Per-Set sharing, set up as the Owners would: Frank and Bob get a per-Set role.
reset role;
insert into public.set_members (set_id, user_id, role)
select s1, '00000000-0000-0000-0000-00000000000f'::uuid, 'helper'::public.set_role from ctx
union all
select s2, '00000000-0000-0000-0000-00000000000b'::uuid, 'viewer'::public.set_role from ctx
union all
select p, '00000000-0000-0000-0000-00000000000d'::uuid, 'viewer'::public.set_role from ctx;
set local role authenticated;

------------------------------------------------------------------------------
-- Group members see the Group's Sets with their Group role
------------------------------------------------------------------------------

select pg_temp.login('b');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'helper',
  'a Group Helper has the Helper role on the Group''s Sets'
);
select pg_temp.login('c');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'viewer',
  'a Group Viewer has the Viewer role on the Group''s Sets'
);
select pg_temp.login('e');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'owner',
  'a Group Owner is an Owner of the Group''s Sets'
);
select is(
  (select group_name from public.set_summaries where id = (select s1 from ctx)),
  'Renamed',
  'the summary carries the Group''s name'
);

select pg_temp.login('d');
select is((select count(*)::int from public.sets where id = (select s1 from ctx)), 0, 'a stranger cannot read the Set');
select is(
  (select count(*)::int from public.set_members where set_id = (select s1 from ctx)),
  0,
  'a stranger cannot read the Set''s members'
);
select is(
  (select count(*)::int from public.set_lines where set_id = (select s1 from ctx)),
  0,
  'a stranger cannot read the Set''s parts'
);

select pg_temp.login('c');
select is(
  (select count(*)::int from public.set_members where set_id = (select s1 from ctx)),
  2,
  'a Group member can read the per-Set member list of a Group Set'
);

------------------------------------------------------------------------------
-- What each Group role may do
------------------------------------------------------------------------------

select pg_temp.login('b');
select is(
  (select sum(found_qty)::int from public.adjust_part((select s1 from ctx), '3001', 4, 1)),
  1,
  'a Group Helper can tick off parts'
);

select pg_temp.login('c');
select throws_ok(
  $$ select public.adjust_part((select s1 from ctx), '3001', 4, 1) $$,
  '42501',
  null,
  'a Group Viewer cannot tick off parts'
);

select pg_temp.login('b');
update public.sets set title = 'Renamed by Bob' where id = (select s1 from ctx);
select is(
  (select title from public.sets where id = (select s1 from ctx)),
  'Renamed by Bob',
  'a Group Helper can rename a Set'
);

select pg_temp.login('c');
update public.sets set title = 'Renamed by Carol' where id = (select s1 from ctx);
select is(
  (select title from public.sets where id = (select s1 from ctx)),
  'Renamed by Bob',
  'a Group Viewer cannot rename a Set'
);

select pg_temp.login('b');
select throws_ok(
  $$ select public.reset_set_progress((select s1 from ctx)) $$,
  '42501',
  null,
  'a Group Helper cannot reset counts'
);
select throws_ok(
  $$ insert into public.set_invites (set_id, role) values ((select s1 from ctx), 'viewer') $$,
  '42501',
  null,
  'a Group Helper cannot create Invites'
);
delete from public.sets where id = (select s2 from ctx);

select pg_temp.login('e');
select lives_ok(
  $$ select public.reset_set_progress((select s1 from ctx)) $$,
  'a Group Owner can reset counts'
);
select is(
  (select sum(found_qty)::int from public.set_lines where set_id = (select s1 from ctx)),
  0,
  'the reset zeroed the counts'
);
select lives_ok(
  $$ insert into public.set_invites (set_id, role) values ((select s1 from ctx), 'viewer') $$,
  'a Group Owner can create Invites for a Group Set'
);
delete from public.sets where id = (select bob_set from ctx);

select pg_temp.login('a');
select is(
  (select count(*)::int from public.sets where id in (select s2 from ctx)),
  1,
  'a Group Helper cannot delete a Set'
);
select is(
  (select count(*)::int from public.sets where id = (select bob_set from ctx)),
  0,
  'a Group Owner can delete a Set in the Group'
);

------------------------------------------------------------------------------
-- The highest of the per-Set and the Group role wins
------------------------------------------------------------------------------

select pg_temp.login('f');
select is(
  (select my_role::text from public.set_summaries where id = (select s1 from ctx)),
  'helper',
  'Group Viewer + per-Set Helper is a Helper'
);
select is(
  (select sum(found_qty)::int from public.adjust_part((select s1 from ctx), '3001', 4, 1)),
  1,
  'the higher per-Set role lets them tick off parts'
);

select pg_temp.login('b');
select is(
  (select my_role::text from public.set_summaries where id = (select s2 from ctx)),
  'helper',
  'Group Helper + per-Set Viewer is a Helper'
);

------------------------------------------------------------------------------
-- Per-Set sharing behaves as before
------------------------------------------------------------------------------

select pg_temp.login('d');
select is(
  (select my_role::text from public.set_summaries where id = (select p from ctx)),
  'viewer',
  'a per-Set Viewer is still a Viewer'
);
select throws_ok(
  $$ select public.adjust_part((select p from ctx), '3001', 4, 1) $$,
  '42501',
  null,
  'a per-Set Viewer still cannot tick off parts'
);
select pg_temp.login('b');
select is(
  (select count(*)::int from public.sets where id = (select p from ctx)),
  0,
  'a Group member does not see the owner''s private Sets'
);

------------------------------------------------------------------------------
-- Realtime: the channel policies use is_set_member on the topic's Set id
------------------------------------------------------------------------------

select ok(
  public.is_set_member(public.set_id_from_topic('set:' || (select s1 from ctx))),
  'a Group member can join the Set''s channel'
);
select pg_temp.login('d');
select ok(
  not public.is_set_member(public.set_id_from_topic('set:' || (select s1 from ctx))),
  'a non-member cannot join the Set''s channel'
);

reset role;
delete from public.group_members
where group_id = (select group_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000b';
set local role authenticated;
select pg_temp.login('b');
select ok(
  not public.is_set_member(public.set_id_from_topic('set:' || (select s1 from ctx))),
  'a removed Group member can no longer join the Set''s channel'
);

------------------------------------------------------------------------------
-- Profiles: Group members see each other's name and avatar, never the email
------------------------------------------------------------------------------

select pg_temp.login('e');
update ctx set g2_id = public.create_group('Empty group');

select pg_temp.login('d');
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  0,
  'a stranger cannot read a profile'
);

reset role;
insert into public.group_members (group_id, user_id, role)
select g2_id, '00000000-0000-0000-0000-00000000000d'::uuid, 'viewer'::public.set_role from ctx;
set local role authenticated;

select pg_temp.login('d');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000e'),
  'Erin',
  'Group members read each other''s profile, even before the Group has Sets'
);
select hasnt_column('public', 'profiles', 'email', 'profiles hold no email');
select throws_ok(
  $$ select email from auth.users $$,
  '42501',
  null,
  'the email cannot be read through the API'
);

------------------------------------------------------------------------------
-- The cap: 10 Groups created per person
------------------------------------------------------------------------------

select pg_temp.login('a');
select lives_ok(
  $$ select public.create_group('Group ' || i) from generate_series(2, 10) as i $$,
  'a person can create 10 Groups'
);
select throws_ok(
  $$ select public.create_group('One too many') $$,
  '54000',
  null,
  'the 11th Group is refused'
);
select pg_temp.login('b');
select lives_ok(
  $$ select public.create_group('Bob''s own') $$,
  'the cap is per person'
);

set local role anon;
select throws_ok(
  $$ select * from public.groups $$,
  '42501',
  null,
  'anon cannot read Groups'
);

select * from finish();
rollback;
