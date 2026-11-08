-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

------------------------------------------------------------------------------
-- Fixtures
--   Alice (a) creates the Group "Family" and is its only Owner. Bob (b) and
--   Dave (d) are Helpers, Carol (c) is a Viewer, Frank (f) is a stranger.
--   Alice added s_a, Bob s_b and Dave s_d, all inside Family. Carol also has a
--   per-Set Viewer role on s_b. "Empty" is a second Group with no Sets, where
--   Alice is Owner and Bob a Helper.
------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000f', 'frank@example.com', '{}', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "gl-1", "name": "Leave set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 2}]'
);

create temporary table ctx (g uuid, g2 uuid, s_a uuid, s_b uuid, s_d uuid);
insert into ctx values (null, null, null, null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

-- Leaves Family as the current user, through RLS. Returns rows deleted.
create function pg_temp.leave_family() returns int
language plpgsql as $$
declare n int;
begin
  delete from public.group_members
  where group_id = (select g from ctx) and user_id = (select auth.uid());
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Deletes a Group through RLS as the current user. Returns rows deleted.
create function pg_temp.delete_group(p_id uuid) returns int
language plpgsql as $$
declare n int;
begin
  delete from public.groups where id = p_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Deletes someone else's membership of Family through RLS. Returns rows deleted.
create function pg_temp.remove_from_family(p_user uuid) returns int
language plpgsql as $$
declare n int;
begin
  delete from public.group_members
  where group_id = (select g from ctx) and user_id = p_user;
  get diagnostics n = row_count;
  return n;
end;
$$;

set local role authenticated;
select pg_temp.login('a');
update ctx set g = public.create_group('Family');
update ctx set g2 = public.create_group('Empty');

reset role;
insert into public.group_members (group_id, user_id, role)
select c.g, u.id, u.role::public.set_role
from ctx c, (values
  ('00000000-0000-0000-0000-00000000000b'::uuid, 'helper'),
  ('00000000-0000-0000-0000-00000000000c'::uuid, 'viewer'),
  ('00000000-0000-0000-0000-00000000000d'::uuid, 'helper')
) as u (id, role);
insert into public.group_members (group_id, user_id, role)
select g2, '00000000-0000-0000-0000-00000000000b', 'helper' from ctx;
set local role authenticated;

select pg_temp.login('a');
with c as (insert into public.sets (set_num, title, group_id) select 'gl-1', 'Alice set', g from ctx returning id)
update ctx set s_a = (select id from c);
select pg_temp.login('b');
with c as (insert into public.sets (set_num, title, group_id) select 'gl-1', 'Bob set', g from ctx returning id)
update ctx set s_b = (select id from c);
select pg_temp.login('d');
with c as (insert into public.sets (set_num, title, group_id) select 'gl-1', 'Dave set', g from ctx returning id)
update ctx set s_d = (select id from c);

reset role;
insert into public.set_members (set_id, user_id, role)
select s_b, '00000000-0000-0000-0000-00000000000c', 'viewer' from ctx;
set local role authenticated;

------------------------------------------------------------------------------
-- Denied
------------------------------------------------------------------------------

select pg_temp.login('c');
select is(
  pg_temp.remove_from_family('00000000-0000-0000-0000-00000000000b'),
  0,
  'a Viewer cannot delete another member''s membership'
);

select pg_temp.login('f');
select is(pg_temp.leave_family(), 0, 'a non-member leaving changes nothing');
select is(pg_temp.delete_group((select g from ctx)), 0, 'a non-member cannot delete a Group');

select pg_temp.login('b');
select is(pg_temp.delete_group((select g2 from ctx)), 0, 'a Helper cannot delete an empty Group');

select pg_temp.login('c');
select is(pg_temp.delete_group((select g from ctx)), 0, 'a Viewer cannot delete a Group');

------------------------------------------------------------------------------
-- The last Owner cannot leave
------------------------------------------------------------------------------

select pg_temp.login('a');
select throws_ok(
  $$ delete from public.group_members
     where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000a' $$,
  '23514',
  'A group needs at least one owner. Promote another member to owner first.',
  'the last Owner cannot leave'
);
select is(
  public.group_role_of((select g from ctx))::text,
  'owner',
  'the last Owner is still in the Group'
);

------------------------------------------------------------------------------
-- A Viewer with a per-Set role leaves: keeps only that per-Set access
------------------------------------------------------------------------------

select pg_temp.login('c');
select is(pg_temp.leave_family(), 1, 'a Viewer leaves the Group');
select is(public.group_role_of((select g from ctx))::text, null, 'they are no longer a member');
select is(
  (select count(*)::int from public.set_summaries where id = (select s_a from ctx)),
  0,
  'they lose access to a Set they only had through the Group'
);
select is(
  (select my_role::text from public.set_summaries where id = (select s_b from ctx)),
  'viewer',
  'they keep their per-Set role on a Set in that Group'
);

------------------------------------------------------------------------------
-- A Helper who added a Set leaves: the Set stays, access is lost
------------------------------------------------------------------------------

select pg_temp.login('b');
select is(pg_temp.leave_family(), 1, 'a Helper leaves the Group');
select is(
  (select count(*)::int from public.set_summaries
   where id in (select s_a from ctx union select s_b from ctx)),
  0,
  'they no longer see the Group''s Sets'
);
select is(
  (select count(*)::int from public.sets where id = (select s_b from ctx)),
  0,
  'not even the Set they added'
);
select is(pg_temp.leave_family(), 0, 'leaving twice changes nothing');

select pg_temp.login('a');
select is(
  (select count(*)::int from public.sets
   where group_id = (select g from ctx)
     and id in (select s_a from ctx union select s_b from ctx)),
  2,
  'the Sets stay in the Group'
);
select is(
  (select count(*)::int from public.group_members where group_id = (select g from ctx)),
  2,
  'only the people who stayed are members'
);

select pg_temp.login('c');
select is(
  (select my_role::text from public.set_summaries where id = (select s_b from ctx)),
  'viewer',
  'the per-Set member still has access after the adder left'
);

------------------------------------------------------------------------------
-- An Owner moves their Set out first, then leaves while another Owner remains
------------------------------------------------------------------------------

select pg_temp.login('a');
update public.group_members set role = 'owner'
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000d';

select pg_temp.login('d');
select lives_ok(
  $$ select public.move_set_to_group((select s_d from ctx), null) $$,
  'the leaver moves their Set out of the Group first'
);
select is(pg_temp.leave_family(), 1, 'an Owner leaves while another Owner remains');
select is(
  (select my_role::text from public.set_summaries where id = (select s_d from ctx)),
  'owner',
  'they still own the Set they moved out'
);
select is(
  (select group_id::text from public.set_summaries where id = (select s_d from ctx)),
  null,
  'and it is in no Group'
);

reset role;
select is(
  (select count(*)::int from public.group_removals where group_id = (select g from ctx)),
  0,
  'leaving on your own is not recorded as a removal'
);
set local role authenticated;

------------------------------------------------------------------------------
-- Deleting a Group
------------------------------------------------------------------------------

select pg_temp.login('a');
select throws_ok(
  $$ delete from public.groups where id = (select g from ctx) $$,
  '55000',
  'A group with sets cannot be deleted. Move or delete its sets first.',
  'a Group with Sets cannot be deleted'
);
select is(
  (select count(*)::int from public.groups where id = (select g from ctx)),
  1,
  'the Group is still there'
);

select is(pg_temp.delete_group((select g2 from ctx)), 1, 'an Owner deletes an empty Group');

select public.move_set_to_group(s_a, null) from ctx;
select public.move_set_to_group(s_b, null) from ctx;
select is(pg_temp.delete_group((select g from ctx)), 1, 'an Owner deletes a Group once its Sets are out');

select is(
  (select count(*)::int from public.groups where id in (select g from ctx union select g2 from ctx)),
  0,
  'the Groups are gone'
);
reset role;
select is(
  (select count(*)::int from public.group_members
   where group_id in (select g from ctx union select g2 from ctx)),
  0,
  'and so are their memberships'
);
select is(
  (select count(*)::int from public.sets where id in (select s_a from ctx union select s_b from ctx)),
  2,
  'the Sets that were moved out still exist'
);

select * from finish();
rollback;
