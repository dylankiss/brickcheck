-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

------------------------------------------------------------------------------
-- Fixtures (as superuser)
------------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name": "Alice"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com', '{}', 'authenticated', 'authenticated');

insert into public.lego_sets (set_num, name, num_parts) values
  ('2-1', 'Not fetched yet', 1);

-- Inventory for 1-1: red 2x4 brick appears as a set line (3), a minifig line (1)
-- and a spare (1); a yellow head only in a minifig; 9-1 is another set.
set local role service_role;
select lives_ok(
  $$ select public.import_set(
       '{"set_num": "1-1", "name": "Test set", "year": 2024, "num_parts": 5}',
       '[
         {"part_num": "3001", "part_name": "Brick 2 x 4", "color_id": 4, "color_name": "Red", "quantity": 3},
         {"part_num": "3001", "part_name": "Brick 2 x 4", "color_id": 4, "color_name": "Red", "quantity": 1, "fig_num": "fig-000001"},
         {"part_num": "3001", "part_name": "Brick 2 x 4", "color_id": 4, "color_name": "Red", "quantity": 1, "is_spare": true},
         {"part_num": "3626", "part_name": "Minifig Head", "color_id": 14, "color_name": "Yellow", "quantity": 1, "fig_num": "fig-000001"}
       ]'
     ) $$,
  'service role can import a set'
);
select lives_ok(
  $$ select public.import_set(
       '{"set_num": "1-1", "name": "Changed name"}',
       '[{"part_num": "9999", "part_name": "Intruder", "color_id": 0, "color_name": "Black", "quantity": 7}]'
     ) $$,
  're-importing an imported set is a no-op'
);
select public.import_set(
  '{"set_num": "9-1", "name": "Other set"}',
  '[{"part_num": "3002", "part_name": "Brick 2 x 3", "color_id": 1, "color_name": "White", "quantity": 1}]'
);
reset role;

select is((select count(*)::int from public.set_parts where set_num = '1-1'), 4, 'inventory is immutable after import');
select is((select name from public.lego_sets where set_num = '1-1'), 'Test set', 'set metadata is untouched by re-import');

select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice',
  'profile is created from auth metadata'
);

create temporary table ctx (check_id uuid, spares_check_id uuid);
insert into ctx values (null, null);
grant all on ctx to authenticated;

------------------------------------------------------------------------------
-- Alice creates checks
------------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

select throws_ok(
  $$ select public.import_set('{"set_num": "x-1"}', '[{}]') $$,
  '42501',
  null,
  'users cannot call import_set'
);

with created as (
  insert into public.checks (set_num, title) values ('1-1', 'My first check') returning id
)
update ctx set check_id = (select id from created);

with created as (
  insert into public.checks (set_num, title, include_spares) values ('1-1', 'With spares', true) returning id
)
update ctx set spares_check_id = (select id from created);

select isnt((select check_id from ctx), null, 'insert ... returning works for the owner');

select is(
  (select role::text from public.check_members where check_id = (select check_id from ctx)),
  'owner',
  'owner membership is created by trigger'
);

select throws_ok(
  $$ insert into public.checks (set_num, title) values ('2-1', 'Too early') $$,
  '23503',
  null,
  'cannot create a check for a set without cached inventory'
);

select throws_ok(
  $$ insert into public.checks (owner_id, set_num, title)
     values ('00000000-0000-0000-0000-00000000000b', '1-1', 'Spoofed') $$,
  '42501',
  null,
  'cannot create a check owned by someone else'
);

select throws_ok(
  $$ update public.checks set include_spares = true $$,
  '42501',
  null,
  'include flags cannot change after creation'
);

select throws_ok(
  $$ insert into public.lego_sets (set_num, name) values ('x-1', 'Nope') $$,
  '42501',
  null,
  'users cannot write the set cache'
);

select throws_ok(
  $$ insert into public.check_progress (check_id, set_part_id, found_qty)
     select check_id, (select id from public.set_parts limit 1), 3 from ctx $$,
  '42501',
  null,
  'users cannot write check_progress directly'
);

------------------------------------------------------------------------------
-- adjust_part: fill order and clamping
------------------------------------------------------------------------------

select is(
  (select count(*)::int from public.check_lines where check_id = (select check_id from ctx)),
  3,
  'check_lines excludes spares when include_spares is false'
);

select is((select public.adjust_part(check_id, '3001', 4, 1) from ctx), 1, 'first tap counts 1');
select is((select public.adjust_part(check_id, '3001', 4, 2) from ctx), 3, 'taps accumulate');
select is(
  (select found_qty from public.check_lines where check_id = (select check_id from ctx) and part_num = '3001' and fig_num is null),
  3,
  'the set line fills first'
);
select is((select public.adjust_part(check_id, '3001', 4, 1) from ctx), 4, 'then the minifig line');
select is((select public.adjust_part(check_id, '3001', 4, 50) from ctx), 4, 'total is clamped to what is needed');
select is((select public.adjust_part(check_id, '3001', 4, -1) from ctx), 3, 'decrement');
select is(
  (select found_qty from public.check_lines where check_id = (select check_id from ctx) and part_num = '3001' and fig_num is not null),
  0,
  'decrements empty the minifig line before the set line'
);
select is((select public.adjust_part(check_id, '3001', 4, -50) from ctx), 0, 'total is clamped to zero');
select is((select public.adjust_part(spares_check_id, '3001', 4, 5) from ctx), 5, 'spares count when included');

select throws_ok(
  $$ select public.adjust_part(check_id, '3002', 1, 1) from ctx $$,
  '22023',
  null,
  'a part from another set is rejected'
);

select throws_ok(
  $$ select public.adjust_part(check_id, '3001', 4, 0) from ctx $$,
  '22023',
  null,
  'zero delta is rejected'
);

select public.adjust_part(check_id, '3001', 4, 2) from ctx;
select results_eq(
  $$ select needed, found from public.check_summaries where id = (select check_id from ctx) $$,
  $$ values (5, 2) $$,
  'summary counts needed (no spares) and found'
);

------------------------------------------------------------------------------
-- Bob is a stranger
------------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

select is((select count(*)::int from public.checks), 0, 'stranger sees no checks');
select is((select count(*)::int from public.check_lines), 0, 'stranger sees no lines');
select is(
  (select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  0,
  'stranger cannot read the owner profile'
);
select throws_ok(
  $$ select public.adjust_part(check_id, '3001', 4, 1) from ctx $$,
  '42501',
  null,
  'stranger cannot adjust counts'
);

------------------------------------------------------------------------------
-- Bob joins as viewer, Carol as helper
------------------------------------------------------------------------------

reset role;
insert into public.check_members (check_id, user_id, role)
select check_id, '00000000-0000-0000-0000-00000000000b'::uuid, 'viewer'::public.check_role from ctx
union all
select check_id, '00000000-0000-0000-0000-00000000000c'::uuid, 'helper'::public.check_role from ctx;
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

select is((select count(*)::int from public.checks), 1, 'viewer sees the shared check only');
select throws_ok(
  $$ select public.adjust_part(check_id, '3001', 4, 1) from ctx $$,
  '42501',
  null,
  'viewer cannot adjust counts'
);
update public.checks set title = 'Hijacked';

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}', true);

select is((select public.adjust_part(check_id, '3626', 14, 1) from ctx), 1, 'helper can adjust counts');
select is((select title from public.checks), 'My first check', 'viewer could not rename the check');
select is(
  (select display_name from public.profiles where id = '00000000-0000-0000-0000-00000000000a'),
  'Alice',
  'co-members can read each other''s profile'
);

------------------------------------------------------------------------------
-- Anonymous
------------------------------------------------------------------------------

reset role;
set local role anon;
select throws_ok(
  $$ select count(*) from public.lego_sets $$,
  '42501',
  null,
  'anonymous users cannot read anything'
);

select * from finish();
rollback;
