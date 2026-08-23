-- Points for showing up. Opening the site once a day is worth 50 points,
-- whether or not you touch anything.
--
-- The whole design problem here is that "a day" and "once" both have to
-- be decided by the server. A client that gets to say which day it is can
-- claim a year of check-ins in one second, and a client that gets to say
-- "I have not checked in yet" can claim the same day forever. So this
-- function takes NO arguments: the date comes from the database clock and
-- the once-ness comes from a unique index, not from a check-then-insert
-- that two tabs could both pass.
--
-- The day rolls at midnight in New York, not UTC. UTC would roll the day
-- at 7pm Eastern - mid-evening for most of the audience, right in the
-- middle of a Sunday night game - and someone who plays every evening
-- would appear to check in twice some days and skip others. A football
-- app can afford to have one clock, and it should be the league's.

alter table public.profiles
  add column if not exists check_in_streak integer not null default 0,
  add column if not exists longest_check_in_streak integer not null default 0,
  add column if not exists last_check_in_on date;

-- No grants for these three. profiles revokes UPDATE from authenticated
-- and re-grants it column by column (see schema.sql), so a new column is
-- unwritable by a client unless someone deliberately adds it to that
-- list. A self-reported streak would be worth nothing.

create or replace function public.daily_check_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in step with the economy: this is the "Check in" line.
  v_points constant integer := 50;
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

-- Creating a function grants EXECUTE to PUBLIC unless it is revoked, and
-- PUBLIC includes anon.
revoke all on function public.daily_check_in() from public;
grant execute on function public.daily_check_in() to authenticated;
