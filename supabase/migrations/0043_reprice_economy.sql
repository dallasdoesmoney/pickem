-- Repricing the economy so that playing beats showing up.
--
-- The problem this fixes, in the only terms that matter - where you land
-- on the ladder:
--
--   a year of only opening the app       36,500 pts   level 26, All-Pro
--   a PERFECT season of actually playing  7,900 pts   level 17, Team Captain
--
-- Someone who never made a single pick outranked someone who was perfect,
-- by nine levels. The check-in was not really the culprit: when GOAT moved
-- from 162,150 to 500,000 in 0040 the ladder got three times longer and
-- nothing the game pays for was repriced to match, so a perfect season
-- topping out at level 17 of 50 was already wrong. The check-in was just
-- the first reward big enough to make it visible.
--
-- So: showing up is the floor, playing is the engine.
--
--   check in                100 -> 25 per day
--   complete a week's card  100 -> 250
--   correct pick            new,  25 each
--   perfect week            new,  1,500
--   correct predictor pick  new,  10 each (~5,440 for a perfect season)
--   lock correct            250, unchanged
--   predictor team complete  50, unchanged
--
-- NOTHING BACKFILLS AT THE OLD PRICE, but the new sources DO pay out
-- retroactively the first time they run, for every already-published week
-- - the same way sync_lock_bonus has always worked. Expect a one-off jump
-- for anyone who has been picking. Rows already written keep whatever they
-- paid at the time: point_events is the ledger of what was actually
-- awarded, and rewriting it would move people's levels under them.

-- ---------------------------------------------------------------------
-- One place that knows how many games a week has.
-- ---------------------------------------------------------------------
-- This table was previously inlined in sync_weekly_pickem_achievements.
-- Perfect Week needs the identical number to decide whether a week was
-- swept, and two copies of a schedule are two copies that can disagree -
-- at which point a swept week silently fails to pay.
create or replace function public.week_game_count(wk integer)
returns integer
language sql
immutable
as $$
  select case wk
    when 1 then 16 when 2 then 16 when 3 then 16 when 4 then 16
    when 5 then 15 when 6 then 14 when 7 then 14 when 8 then 14
    when 9 then 15 when 10 then 14 when 11 then 13 when 12 then 16
    when 13 then 14 when 14 then 15 when 15 then 16 when 16 then 16
    when 17 then 16 when 18 then 16
    else 999
  end;
$$;

-- ---------------------------------------------------------------------
-- Check in: 100 -> 25 per day.
-- ---------------------------------------------------------------------
create or replace function public.daily_check_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in step with src/data/achievements.ts's daily_check_in
  -- pointsEach, which is the number the Challenges card promises.
  v_points constant integer := 25;
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

  insert into public.point_events (user_id, source, points, reference_id)
  values (v_uid, 'daily_check_in', v_points, v_today::text)
  on conflict (user_id, source, reference_id) do nothing;
  get diagnostics v_rows = row_count;
  v_awarded := v_rows > 0;

  select last_check_in_on, check_in_streak, longest_check_in_streak
    into v_last, v_streak, v_longest
    from public.profiles
    where id = v_uid
    for update;

  if v_awarded then
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

-- ---------------------------------------------------------------------
-- Complete a week's card: 100 -> 250.
-- ---------------------------------------------------------------------
create or replace function public.sync_weekly_pickem_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select auth.uid(), 'weekly_pickem_complete', 250, wp.week::text
  from public.weekly_picks wp
  where wp.user_id = auth.uid()
  group by wp.week
  having count(distinct wp.game_id) >= public.week_game_count(wp.week)
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Correct pick: 25 each, and a swept week: 1,500.
-- ---------------------------------------------------------------------
-- Both grade off published weeks only, exactly like sync_lock_bonus - an
-- unpublished week has no results to be right about. Idempotent on
-- (user_id, source, reference_id), so this is safe to call on every page
-- load and pays out any week that has been published since last time.
create or replace function public.sync_correct_picks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'correct_pick', 25, wp.week::text || ':' || wp.game_id
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.team_abbr = gr.winner
  on conflict (user_id, source, reference_id) do nothing;

  -- A week counts as swept when the number of CORRECT picks in it reaches
  -- the number of games it has - which also implies the card was full, so
  -- there is no separate completeness check to keep in step.
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'perfect_week', 1500, wp.week::text
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.team_abbr = gr.winner
  group by wp.user_id, wp.week
  having count(distinct wp.game_id) >= public.week_game_count(wp.week)
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;

revoke all on function public.sync_correct_picks() from public;
grant execute on function public.sync_correct_picks() to authenticated;

-- ---------------------------------------------------------------------
-- Correct season-predictor pick: 10 each.
-- ---------------------------------------------------------------------
-- Paid per correct prediction as weeks are published, rather than as one
-- season-end lump: it is the same idempotent-insert machinery as
-- everything else here, it gives feedback while the season is still
-- running, and it needs no "the season is over" trigger - which does not
-- exist yet. 32 teams x 17 weeks x 10 = 5,440 for a flawless season.
--
-- COUPLED TO THE GAME ID FORMAT. season_picks stores (tracked_team,
-- week); game_results stores (game_id, week, winner) and nowhere records
-- who played whom - the schedule lives in src/data/games.ts, not in the
-- database. The one link between them is the id itself, which is
-- '{year}-w{week}-{away}-{home}', so parts 3 and 4 are the two teams. If
-- that format ever changes, this silently stops paying rather than
-- erroring. A games table would be the real fix.
create or replace function public.sync_predictor_accuracy()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select sp.user_id, 'predictor_correct', 10, sp.tracked_team || ':' || sp.week::text
  from public.season_picks sp
  join public.weeks w on w.week = sp.week and w.results_published = true
  join public.game_results gr
    on gr.week = sp.week
   and lower(sp.tracked_team) in (split_part(gr.game_id, '-', 3), split_part(gr.game_id, '-', 4))
  where sp.user_id = auth.uid()
    and gr.winner = sp.predicted_winner
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;

revoke all on function public.sync_predictor_accuracy() from public;
grant execute on function public.sync_predictor_accuracy() to authenticated;
