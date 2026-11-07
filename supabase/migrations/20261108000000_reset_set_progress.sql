-- Reset a set's counts: the owner sets every part's found count back to zero.
-- Rows are updated, not deleted, so clients that refetch progress see zeros
-- (a missing row also means 0, but clients only apply the rows they receive).

-- The progress trigger skips its per-row broadcast while a reset runs: a set with
-- hundreds of counted parts would otherwise send hundreds of messages at once.
-- reset_set_progress sends one `changed` broadcast instead, and every open page
-- refetches the progress.
create or replace function public.set_progress_broadcast()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('brickcheck.skip_progress_broadcast', true) = 'on' then
    return null;
  end if;
  -- Zero rows inserted by adjust_part carry no news.
  if tg_op = 'UPDATE' and new.found_qty = old.found_qty then
    return null;
  end if;
  if tg_op = 'INSERT' and new.found_qty = 0 then
    return null;
  end if;
  perform realtime.send(
    jsonb_build_object(
      'line_id', new.line_id,
      'found_qty', new.found_qty,
      'updated_at', new.updated_at,
      'updated_by', new.updated_by
    ),
    'progress',
    'set:' || new.set_id::text,
    true
  );
  return null;
end;
$$;

create function public.reset_set_progress(p_set_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_set_owner(p_set_id) then
    raise exception 'Only the owner can reset this set' using errcode = '42501';
  end if;

  -- Lock the counted rows in line_id order, like adjust_part, so a tap made at
  -- the same moment cannot deadlock with this reset.
  perform 1
  from public.set_progress
  where set_id = p_set_id and found_qty <> 0
  order by line_id
  for update;

  perform set_config('brickcheck.skip_progress_broadcast', 'on', true);
  update public.set_progress
  set found_qty = 0,
      updated_at = clock_timestamp(),
      updated_by = (select auth.uid())
  where set_id = p_set_id and found_qty <> 0;
  perform set_config('brickcheck.skip_progress_broadcast', 'off', true);

  -- Touching the set row fires the `changed` broadcast (sets_broadcast), which
  -- makes every open page refetch the progress.
  update public.sets set title = title where id = p_set_id;
end;
$$;

revoke execute on function public.reset_set_progress(uuid) from public, anon;
grant execute on function public.reset_set_progress(uuid) to authenticated;
