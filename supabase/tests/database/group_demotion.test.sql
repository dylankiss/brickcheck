-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

------------------------------------------------------------------------------
-- Fixtures
--   Alice (a) is the Owner of "Family". Bob (b) and Dave (d) are Helpers. Each
--   adds a Set in Family (s_b, s_d), which gives them a per-Set Owner row. Bob
--   also adds s_out outside any Group.
------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', '{}', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "gd-1", "name": "Demotion set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 5}]'
);

create temporary table ctx (g uuid, s_b uuid, s_d uuid, s_out uuid);
insert into ctx values (null, null, null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

-- Deletes a Set through RLS as the current user. Returns rows deleted.
create function pg_temp.delete_set(p_id uuid) returns int
language plpgsql as $$
declare n int;
begin
  delete from public.sets where id = p_id;
  get diagnostics n = row_count;
  return n;
end;
$$;

set local role authenticated;
select pg_temp.login('a');
update ctx set g = public.create_group('  Family  ');

reset role;
insert into public.group_members (group_id, user_id, role)
select g, u.id, 'helper' from ctx, (values
  ('00000000-0000-0000-0000-00000000000b'::uuid),
  ('00000000-0000-0000-0000-00000000000d'::uuid)
) as u (id);
set local role authenticated;

select pg_temp.login('b');
with c as (insert into public.sets (set_num, title, group_id) select 'gd-1', 'Bob set', g from ctx returning id)
update ctx set s_b = (select id from c);
with c as (insert into public.sets (set_num, title) values ('gd-1', 'Bob alone') returning id)
update ctx set s_out = (select id from c);
select pg_temp.login('d');
with c as (insert into public.sets (set_num, title, group_id) select 'gd-1', 'Dave set', g from ctx returning id)
update ctx set s_d = (select id from c);

------------------------------------------------------------------------------
-- Before: the adder is an Owner of their Set
------------------------------------------------------------------------------

select pg_temp.login('b');
select is(public.set_role_of((select s_b from ctx))::text, 'owner', 'a Helper who added a Set owns it');

------------------------------------------------------------------------------
-- Demote Bob to Viewer
------------------------------------------------------------------------------

select pg_temp.login('a');
update public.group_members set role = 'viewer'
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000b';

select pg_temp.login('b');
select is(public.set_role_of((select s_b from ctx))::text, 'viewer', 'a demoted Helper is only a Viewer of the Set they added');
select throws_ok(
  $$ select public.adjust_part((select s_b from ctx), '3001', 4, 1) $$,
  '42501',
  'Not allowed to edit this set',
  'and can no longer tick off parts'
);
select is(pg_temp.delete_set((select s_b from ctx)), 0, 'nor delete it');
select is(
  public.set_role_of((select s_d from ctx))::text,
  'helper',
  'they are a Helper on other people''s Sets, per their Group role'
);
select is(
  public.set_role_of((select s_out from ctx))::text,
  'owner',
  'a Set they added outside the Group is untouched'
);

------------------------------------------------------------------------------
-- Demote Dave from Helper... Alice first promotes him to Owner, then back down
------------------------------------------------------------------------------

select pg_temp.login('a');
update public.group_members set role = 'owner'
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000d';
update public.group_members set role = 'helper'
where group_id = (select g from ctx) and user_id = '00000000-0000-0000-0000-00000000000d';

select pg_temp.login('d');
select is(public.set_role_of((select s_d from ctx))::text, 'helper', 'demoting an Owner to Helper lowers their own Set to Helper');
select is(pg_temp.delete_set((select s_d from ctx)), 0, 'and they cannot delete it');
select is(
  (select sum(found_qty)::int from public.adjust_part((select s_d from ctx), '3001', 4, 1)),
  1,
  'but they can still tick off parts'
);

select pg_temp.login('a');
select is(
  public.set_role_of((select s_d from ctx))::text,
  'owner',
  'a Group Owner still owns every Set in the Group'
);

------------------------------------------------------------------------------
-- Group names are stored trimmed, also when renamed
------------------------------------------------------------------------------

select is((select name from public.groups where id = (select g from ctx)), 'Family', 'create_group stores a trimmed name');
update public.groups set name = '   Bricks  ' where id = (select g from ctx);
select is((select name from public.groups where id = (select g from ctx)), 'Bricks', 'a rename is stored trimmed');

select * from finish();
rollback;
