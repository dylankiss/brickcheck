-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

------------------------------------------------------------------------------
-- Fixtures: Alice owns a set on 1-1 (with include_minifigs = false),
-- Bob is a helper, Carol a viewer, Dave a stranger.
------------------------------------------------------------------------------

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "t1-1", "name": "Test set"}',
  '[
    {"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 2, "element_id": "300121"},
    {"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 1, "element_id": "4211"},
    {"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 1, "is_spare": true},
    {"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 1, "fig_num": "fig-1"}
  ]'
);

select is(
  (select quantity from public.inventory_lines where set_num = 't1-1' and not is_spare and fig_num is null),
  3,
  'import_set merges duplicate part + color rows instead of dropping them'
);

select throws_ok(
  $$ select public.import_set('{"set_num": "tx-1"}', '[]') $$,
  '22023',
  null,
  'import_set rejects an empty inventory'
);

create temporary table ctx (set_id uuid, no_figs_set_id uuid);
insert into ctx values (null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

set local role authenticated;
select pg_temp.login('a');
with c as (insert into public.sets (set_num, title, include_spares) values ('t1-1', 'Shared', true) returning id)
update ctx set set_id = (select id from c);
with c as (insert into public.sets (set_num, title, include_minifigs) values ('t1-1', 'No figs', false) returning id)
update ctx set no_figs_set_id = (select id from c);

reset role;
insert into public.set_members (set_id, user_id, role)
select set_id, '00000000-0000-0000-0000-00000000000b'::uuid, 'helper'::public.set_role from ctx
union all
select set_id, '00000000-0000-0000-0000-00000000000c'::uuid, 'viewer'::public.set_role from ctx;
set local role authenticated;

------------------------------------------------------------------------------
-- Counting rules
------------------------------------------------------------------------------

select pg_temp.login('a');

select is(
  (select count(*)::int from public.set_lines where set_id = (select no_figs_set_id from ctx)),
  1,
  'include_minifigs = false leaves only the set line (spares excluded too)'
);

select is(
  (select sum(found_qty)::int from public.adjust_part((select no_figs_set_id from ctx), '3001', 4, 9)),
  3,
  'without minifigs the part is capped at the set line'
);

select is(
  (select sum(found_qty)::int from public.adjust_part((select set_id from ctx), '3001', 4, 5)),
  5,
  'with spares and minifigs everything fills'
);
select is(
  (select sum(found_qty)::int from public.adjust_part((select set_id from ctx), '3001', 4, -1)),
  4,
  'decrement'
);
select is(
  (select found_qty from public.set_lines where set_id = (select set_id from ctx) and is_spare),
  0,
  'decrements empty the spare line first'
);
select is(
  (select count(*)::int from public.adjust_part((select set_id from ctx), '3001', 4, 1)),
  3,
  'adjust_part returns every line of the part'
);
select throws_ok(
  $$ select public.adjust_part((select set_id from ctx), '3001', 4, 10001) $$,
  '22023',
  null,
  'huge deltas are rejected'
);

------------------------------------------------------------------------------
-- Membership rules
------------------------------------------------------------------------------

delete from public.set_members
where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from public.set_members where user_id = '00000000-0000-0000-0000-00000000000a' and set_id = (select set_id from ctx)),
  1,
  'the owner cannot leave their own set'
);

select throws_ok(
  $$ update public.set_members set role = 'owner'
     where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000c' $$,
  '42501',
  null,
  'nobody can be promoted to owner'
);

update public.set_members set role = 'helper'
where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000c';
select is(
  (select role::text from public.set_members where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000c'),
  'helper',
  'the owner can change roles'
);

select pg_temp.login('b');
update public.set_members set role = 'viewer'
where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000c';
select is(
  (select role::text from public.set_members where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000c'),
  'helper',
  'a helper cannot change roles'
);

delete from public.set_members where user_id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select count(*)::int from public.set_members where set_id = (select set_id from ctx)),
  3,
  'a helper cannot remove the owner'
);

update public.sets set title = 'Renamed by helper' where id = (select set_id from ctx);
select is(
  (select title from public.sets where id = (select set_id from ctx)),
  'Renamed by helper',
  'a helper can rename the set'
);

delete from public.sets where id = (select set_id from ctx);
select is(
  (select count(*)::int from public.sets where id = (select set_id from ctx)),
  1,
  'a helper cannot delete the set'
);

select pg_temp.login('c');
delete from public.set_members
where set_id = (select set_id from ctx) and user_id = '00000000-0000-0000-0000-00000000000c';
select is(
  (select count(*)::int from public.sets where id = (select set_id from ctx)),
  0,
  'a member can leave, and then no longer sees the set'
);

------------------------------------------------------------------------------
-- Invites
------------------------------------------------------------------------------

select pg_temp.login('b');
select throws_ok(
  $$ insert into public.set_invites (set_id) select set_id from ctx $$,
  '42501',
  null,
  'a non-owner cannot create invites'
);

select pg_temp.login('a');
select lives_ok(
  $$ insert into public.set_invites (set_id, role) select set_id, 'viewer' from ctx $$,
  'the owner can create invites'
);
select throws_ok(
  $$ insert into public.set_invites (set_id, role) select set_id, 'owner' from ctx $$,
  '23514',
  null,
  'invites cannot grant owner'
);
select throws_ok(
  $$ insert into public.set_invites (set_id, token) select set_id, gen_random_uuid() from ctx $$,
  '42501',
  null,
  'the owner cannot choose the token'
);
select throws_ok(
  $$ insert into public.set_invites (set_id, expires_at) select set_id, now() + interval '1 year' from ctx $$,
  '23514',
  null,
  'invites expire within 30 days'
);

select pg_temp.login('b');
select is((select count(*)::int from public.set_invites), 0, 'a non-owner cannot read invites');

------------------------------------------------------------------------------
-- Profiles
------------------------------------------------------------------------------

update public.profiles set display_name = 'Hacked' where id = '00000000-0000-0000-0000-00000000000a';
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  null,
  'users cannot update someone else''s profile'
);
select throws_ok(
  $$ update public.profiles set id = gen_random_uuid() where id = '00000000-0000-0000-0000-00000000000b' $$,
  '42501',
  null,
  'users cannot change their profile id'
);

------------------------------------------------------------------------------
-- Realtime channel access
------------------------------------------------------------------------------

select is(
  (select public.set_id_from_topic('set:' || set_id::text) from ctx),
  (select set_id from ctx),
  'topic parses to the set id'
);
select is(public.set_id_from_topic('set:not-a-uuid'), null, 'malformed topics map to null');

select pg_temp.login('d');
select is(
  (select public.is_set_member(set_id) from ctx),
  false,
  'a stranger is not a member, so channel policies deny them'
);

------------------------------------------------------------------------------
-- Anonymous access
------------------------------------------------------------------------------

reset role;
select is(
  (select count(*)::int from information_schema.role_table_grants
   where grantee = 'anon' and table_schema = 'public'),
  0,
  'anon has no privileges on any public table or view'
);
select is(
  (select count(*)::int from information_schema.routine_privileges
   where grantee in ('anon', 'PUBLIC') and routine_schema = 'public'),
  0,
  'anon cannot execute any public function'
);
select is(
  (select count(*)::int from pg_default_acl d
   cross join lateral aclexplode(d.defaclacl) acl
   join pg_namespace n on n.oid = d.defaclnamespace
   where n.nspname = 'public' and acl.grantee = 'anon'::regrole
     -- Migrations run as postgres; supabase_admin's defaults only cover platform objects.
     and d.defaclrole = 'postgres'::regrole),
  0,
  'objects created by later migrations are not granted to anon'
);
select is(
  public.claim_import('00000000-0000-0000-0000-00000000000a', 'tz-1', 1),
  'ok',
  'first import claim succeeds'
);
select is(
  public.claim_import('00000000-0000-0000-0000-00000000000b', 'tz-1', 5),
  'in_progress',
  'a concurrent import of the same set is refused'
);
select is(
  public.claim_import('00000000-0000-0000-0000-00000000000a', 'tz-2', 1),
  'rate_limited',
  'the per-user hourly limit applies'
);
set local role authenticated;
select pg_temp.login('a');
select throws_ok(
  $$ select public.claim_import('00000000-0000-0000-0000-00000000000a', 'tz-3', 100) $$,
  '42501',
  null,
  'users cannot call claim_import'
);
reset role;
set local role anon;
select throws_ok(
  $$ select public.adjust_part(gen_random_uuid(), '3001', 4, 1) $$,
  '42501',
  null,
  'anon cannot call adjust_part'
);

select * from finish();
rollback;
