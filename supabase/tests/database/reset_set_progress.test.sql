-- Run with: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

-- Fixtures: Alice owns two sets of the same catalog set, Bob is a helper of the
-- first, Dave is a stranger.
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com', 'authenticated', 'authenticated');

select public.import_set(
  '{"set_num": "tr-1", "name": "Reset set"}',
  '[{"part_num": "3001", "part_name": "Brick", "color_id": 4, "color_name": "Red", "quantity": 4, "element_id": "300121"}]'
);

create temporary table ctx (set_id uuid, other_set_id uuid);
insert into ctx values (null, null);
grant all on ctx to authenticated;

create function pg_temp.login(p_user text) returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', '00000000-0000-0000-0000-00000000000' || p_user, 'role', 'authenticated')::text,
    true);
$$;

set local role authenticated;
select pg_temp.login('a');
with c as (insert into public.sets (set_num, title) values ('tr-1', 'Reset me') returning id)
update ctx set set_id = (select id from c);
with c as (insert into public.sets (set_num, title) values ('tr-1', 'Leave me') returning id)
update ctx set other_set_id = (select id from c);

reset role;
insert into public.set_members (set_id, user_id, role)
select set_id, '00000000-0000-0000-0000-00000000000b'::uuid, 'helper'::public.set_role from ctx;
set local role authenticated;

-- Taps: Alice counts one piece in her other set, Bob counts three in the first.
-- In DO blocks: a bare select would print rows that TAP does not expect.
select pg_temp.login('a');
do $$
begin
  perform public.adjust_part((select other_set_id from ctx), '3001', 4, 1);
end;
$$;
select pg_temp.login('b');
do $$
begin
  perform public.adjust_part((select set_id from ctx), '3001', 4, 3);
end;
$$;

select is(
  (select sum(found_qty)::int from public.set_progress where set_id = (select set_id from ctx)),
  3,
  'taps are counted before the reset'
);

select throws_ok(
  $$ select public.reset_set_progress((select set_id from ctx)) $$,
  '42501',
  null,
  'a helper cannot reset the counts'
);

select pg_temp.login('d');
select throws_ok(
  $$ select public.reset_set_progress((select set_id from ctx)) $$,
  '42501',
  null,
  'a stranger cannot reset the counts'
);

select pg_temp.login('a');
do $$
begin
  perform public.reset_set_progress((select set_id from ctx));
end;
$$;

select is(
  (select sum(found_qty)::int from public.set_progress where set_id = (select set_id from ctx)),
  0,
  'the owner resets every count to zero'
);
select is(
  (select sum(found_qty)::int from public.set_progress where set_id = (select other_set_id from ctx)),
  1,
  'other sets keep their counts'
);
select is(
  (select title from public.sets where id = (select set_id from ctx)),
  'Reset me',
  'the set itself is unchanged'
);

-- Counting works again after a reset.
select pg_temp.login('b');
select is(
  (select sum(found_qty)::int from public.adjust_part((select set_id from ctx), '3001', 4, 2)),
  2,
  'parts can be counted again after a reset'
);

select * from finish();
rollback;
