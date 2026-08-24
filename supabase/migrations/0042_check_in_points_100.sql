-- Check-in goes from 50 points to 100.
--
-- The number is the whole change; everything else about the function is
-- as 0041 left it. It is replaced rather than patched because the amount
-- is a constant inside the body - there is nowhere else to set it, and
-- putting it in a settings table would be a lot of machinery for a value
-- that changes about once a year.
--
-- Already-claimed days keep whatever they paid at the time. Nothing
-- backfills, and it should not: point_events is the ledger of what was
-- actually awarded, and rewriting history there would silently move
-- people's levels under them.
--
-- If 0041 has not been run yet, run it first - this file only replaces
-- the function and assumes 0041's three columns on profiles exist.

create or replace function public.daily_check_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in step with the economy: this is the "Check in" line, and with
  -- src/data/achievements.ts's daily_check_in pointsEach, which is what
  -- the Challenges card promises.
  v_points constant integer := 100;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_uid uuid := auth.uid();
  v_last date;
  v_streak integer;
  v_longest integer;
  v_rows integer;
  v_awarded boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  -- The unique index on (user_id, source, reference_id) is what makes
  -- this once a day, so two tabs opening at the same moment cannot both
  -- score. Nothing reads-then-writes.
  insert into public.point_events (user_id, source, points, reference_id)
  values (v_uid, 'daily_check_in', v_points, v_today::text)
  on conflict (user_id, source, reference_id) do nothing;
  get diagnostics v_rows = row_count;
  v_awarded := v_rows > 0;

  -- for update so a second call cannot read the same stale streak and
  -- write it back - the same lock sync_level_up_notifications takes.
  select last_check_in_on, check_in_streak, longest_check_in_streak
    into v_last, v_streak, v_longest
    from public.profiles
    where id = v_uid
    for update;

  if v_awarded then
    -- Consecutive only if yesterday was the last one. Any longer gap
    -- starts again at 1 - including the first check-in ever, where
    -- v_last is null.
    if v_last = v_today - 1 then
      v_streak := coalesce(v_streak, 0) + 1;
    else
      v_streak := 1;
    end if;
    v_longest := greatest(coalesce(v_longest, 0), v_streak);

    update public.profiles
      set check_in_streak = v_streak,
          longest_check_in_streak = v_longest,
          last_check_in_on = v_today
      where id = v_uid;
  end if;

  return jsonb_build_object(
    'awarded', v_awarded,
    'points', case when v_awarded then v_points else 0 end,
    'streak', coalesce(v_streak, 0),
    'longest', coalesce(v_longest, 0)
  );
end;
$$;

revoke all on function public.daily_check_in() from public;
grant execute on function public.daily_check_in() to authenticated;
