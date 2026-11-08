-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(41);

------------------------------------------------------------------------------
-- Fixtures
--   Alice (a) creates the Group "Family" and is its only Owner. Bob (b) is a
--   Helper, Carol (c) a Viewer, Dave (d) a Viewer. Frank (f) is a stranger.
--   Alice added the Set s_a and Bob the Set s_b, both inside the Group.
------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'frank@example.com', '{}', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "gm-1", "name": "Member set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 2}]'
);

create temporary table ctx (
  g uuid, s_a uuid, s_b uuid, old_token uuid, new_token uuid, messages_before int
);
insert into ctx values (null, null, null, null, null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

-- Rows changed or removed in the test Group, through RLS as the current user.
-- A null user means every member.
create function pg_temp.set_role_rows(p_user uuid, p_role text) returns int
language plpgsql as $$
declare n int;
begin
  update public.group_members set role = p_role::public.set_role
  where group_id = (select g from ctx) and (p_user is null or user_id = p_user);
  get diagnostics n = row_count;
  return n;
end;
$$;

create function pg_temp.remove_rows(p_user uuid) returns int
language plpgsql as $$
declare n int;
begin
  delete from public.group_members
  where group_id = (select g from ctx) and (p_user is null or user_id = p_user);
  get diagnostics n = row_count;
  return n;
end;
$$;

set local role authenticated;
select pg_temp.login('a');
update ctx set g = public.create_group('Family');

reset role;
insert into public.group_members (group_id, user_id, role)
select g, u.id, u.role::public.set_role
from ctx, (values
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'helper'),
  ('00000000-0000-0000-0000-00000000000c'::uuid, 'viewer'),
  ('00000000-0000-0000-0000-00000000000d'::uuid, 'viewer')
) as u (id, role);
set local role authenticated;

select pg_temp.login('a');
with c as (insert into public.sets (set_num, title, group_id) select 'gm-1', 'Alice set', g from ctx returning id)
update ctx set s_a = (select id from c);
select pg_temp.login('b');
with c as (insert into public.sets (set_num, title, group_id) select 'gm-1', 'Bob set', g from ctx returning id)
update ctx set s_b = (select id from c);

------------------------------------------------------------------------------
-- Denied: only Owners change roles or remove
------------------------------------------------------------------------------

select pg_temp.login('b');
select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000b', 'owner'),
  0,
  'a Helper cannot promote themselves to Owner'
);
select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000c', 'helper'),
  0,
  'a Helper cannot change another member''s role'
);
select is(
  pg_temp.remove_rows('00000000-0000-0000-0000-00000000000c'),
  0,
  'a Helper cannot remove a member'
);

select pg_temp.login('c');
select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000c', 'owner'),
  0,
  'a Viewer cannot promote themselves to Owner'
);

select pg_temp.login('f');
select is(
  pg_temp.set_role_rows(null, 'viewer'),
  0,
  'a non-member cannot change roles'
);
select is(
  pg_temp.remove_rows(null),
  0,
  'a non-member cannot remove members'
);

-- Only the role of a membership can be updated, not whose it is.
select pg_temp.login('a');
select throws_ok(
  $$ update public.group_members set user_id = '00000000-0000-0000-0000-00000000000f'
     where user_id = '00000000-0000-0000-0000-00000000000d' $$,
  '42501',
  null,
  'only the role of a membership can be updated'
);

select is(
  (select count(*)::int from public.group_members where group_id = (select g from ctx)),
  4,
  'the denied changes left every member in place'
);

------------------------------------------------------------------------------
-- Owners change roles
------------------------------------------------------------------------------

select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000c', 'helper'),
  1,
  'an Owner changes a Viewer to Helper'
);
select pg_temp.login('c');
select is(
  public.group_role_of((select g from ctx))::text,
  'helper',
  'the member has the new role'
);
select pg_temp.login('a');
select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000c', 'viewer'),
  1,
  'an Owner changes a Helper back to Viewer'
);

------------------------------------------------------------------------------
-- The last Owner cannot be demoted or removed
------------------------------------------------------------------------------

select throws_ok(
  $$ update public.group_members set role = 'helper'
     where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514',
  'A group needs at least one owner. Promote another member to owner first.',
  'the last Owner cannot be demoted'
);
select throws_ok(
  $$ delete from public.group_members
     where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514',
  'A group needs at least one owner. Promote another member to owner first.',
  'the last Owner cannot be removed'
);
select is(
  public.group_role_of((select g from ctx))::text,
  'owner',
  'the last Owner is still an Owner'
);

------------------------------------------------------------------------------
-- Promote, and an Owner removing another Owner
------------------------------------------------------------------------------

select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000b', 'owner'),
  1,
  'an Owner promotes a Helper to Owner'
);
select pg_temp.login('b');
select is(
  (select my_role::text from public.set_summaries where id = (select s_a from ctx)),
  'owner',
  'the new Owner is an Owner of every Set in the Group'
);

-- With two Owners, an Owner can demote themselves, and be promoted back.
select pg_temp.login('a');
select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000a', 'helper'),
  1,
  'an Owner can demote themselves while another Owner remains'
);
select pg_temp.login('b');
select is(
  pg_temp.set_role_rows('00000000-0000-0000-0000-00000000000a', 'owner'),
  1,
  'the other Owner promotes them back'
);

reset role;
update ctx set messages_before = (
  select count(*)::int from realtime.messages
  where topic = 'set:' || s_a::text and event = 'changed'
);
-- An older link, created by Alice while she was an Owner.
with i as (
  insert into public.group_invites (group_id, created_by)
  select g, '00000000-0000-0000-0000-00000000000a' from ctx returning token
)
update ctx set old_token = (select token from i);
set local role authenticated;

select pg_temp.login('b');
select is(
  pg_temp.remove_rows('00000000-0000-0000-0000-00000000000a'),
  1,
  'an Owner removes another Owner'
);

------------------------------------------------------------------------------
-- The removed Owner: no access, Sets stay, removal recorded
------------------------------------------------------------------------------

select pg_temp.login('a');
select is(
  (select count(*)::int from public.group_members where group_id = (select g from ctx)),
  0,
  'the removed person can no longer read the Group''s members'
);
select is(
  (select count(*)::int from public.set_summaries
   where id in (select s_a from ctx union select s_b from ctx)),
  0,
  'the removed person no longer sees the Group''s Sets in their list'
);
select is(
  (select count(*)::int from public.sets where id = (select s_a from ctx)),
  0,
  'not even the Set they added'
);
select is(
  (select count(*)::int from public.set_lines where set_id = (select s_a from ctx)),
  0,
  'and cannot read its parts'
);
select ok(
  not public.is_set_member(public.set_id_from_topic('set:' || (select s_a from ctx))),
  'and cannot join its channel'
);

reset role;
select is(
  (select count(*)::int from public.sets
   where group_id = (select g from ctx) and id in (select s_a from ctx union select s_b from ctx)),
  2,
  'the Sets the removed person added stay in the Group'
);
select is(
  (select count(*)::int from public.group_removals
   where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000a'),
  1,
  'the removal is recorded'
);
select ok(
  (select count(*)::int from realtime.messages
   where topic = 'set:' || (select s_a from ctx)::text and event = 'changed')
  - (select messages_before from ctx) >= 1,
  'the removal is broadcast on the Group''s Set channel'
);
set local role authenticated;

------------------------------------------------------------------------------
-- Removal blocks older links; a newer one works and clears the record
------------------------------------------------------------------------------

select pg_temp.login('a');
select throws_ok(
  $$ select public.accept_group_invite(old_token) from ctx $$,
  'P0002',
  null,
  'a removed person cannot rejoin with an older Group invite'
);

reset role;
with i as (
  insert into public.group_invites (group_id, created_by, created_at)
  select g, '00000000-0000-0000-0000-00000000000b', now() + interval '1 second' from ctx
  returning token
)
update ctx set new_token = (select token from i);
set local role authenticated;
select pg_temp.login('a');
select lives_ok(
  $$ select public.accept_group_invite(new_token) from ctx $$,
  'a newer Group invite lets them back in'
);
reset role;
select is(
  (select count(*)::int from public.group_removals where user_id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'accepting a newer Group invite clears the removal'
);
set local role authenticated;
select pg_temp.login('a');
select is(
  (select my_role::text from public.set_summaries where id = (select s_a from ctx)),
  'helper',
  'back in, they are a Helper, not the Owner of the Set they added'
);

------------------------------------------------------------------------------
-- Removing the person who added a Set: it stays, they lose access
------------------------------------------------------------------------------

-- Bob is the only Owner now: he cannot remove himself, but he can promote
-- Alice, who then removes him.
select pg_temp.login('b');
select throws_ok(
  $$ delete from public.group_members
     where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000b' $$,
  '23514',
  'A group needs at least one owner. Promote another member to owner first.',
  'the only Owner cannot remove themselves'
);
update public.group_members set role = 'owner'
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.login('a');
delete from public.group_members
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000b';

select pg_temp.login('b');
select is(
  (select count(*)::int from public.sets where id = (select s_b from ctx)),
  0,
  'a removed adder cannot read the Set they added'
);
select is(
  (select count(*)::int from public.set_summaries where id = (select s_b from ctx)),
  0,
  'and does not see it in their list'
);
select pg_temp.login('a');
select is(
  (select my_role::text from public.set_summaries where id = (select s_b from ctx)),
  'owner',
  'the Set stays in the Group and its Owners can still manage it'
);
select is(
  (select count(*)::int from public.sets where group_id = (select g from ctx)),
  2,
  'both Sets are still in the Group'
);

-- A per-Set role someone was given is kept when they are removed.
reset role;
insert into public.set_members (set_id, user_id, role)
select s_a, '00000000-0000-0000-0000-00000000000c', 'viewer' from ctx;
set local role authenticated;
select pg_temp.login('a');
delete from public.group_members
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000c';
select pg_temp.login('c');
select is(
  (select my_role::text from public.set_summaries where id = (select s_a from ctx)),
  'viewer',
  'a removed member keeps a per-Set role they were given on a Set'
);
select is(
  (select count(*)::int from public.set_summaries where id = (select s_b from ctx)),
  0,
  'but loses the Group''s other Sets'
);

------------------------------------------------------------------------------
-- Deleting a Group or an account is not blocked by the last-Owner rule
------------------------------------------------------------------------------

reset role;
insert into public.groups (name, created_by)
values ('Empty', '00000000-0000-0000-0000-00000000000d');
select lives_ok(
  $$ delete from public.groups where name = 'Empty' $$,
  'deleting a Group removes its only Owner without tripping the rule'
);
insert into public.groups (name, created_by)
values ('Frank''s', '00000000-0000-0000-0000-00000000000f');
select lives_ok(
  $$ delete from auth.users where id = '00000000-0000-0000-0000-00000000000f' $$,
  'deleting an account is not blocked by being the last Owner of a Group'
);

select * from finish();
rollback;
