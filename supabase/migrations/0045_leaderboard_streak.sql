-- Put the daily-check-in streak on the leaderboard.
--
-- WHY THIS IS NOT JUST check_in_streak. That column is only rewritten
-- when someone next checks in, so it is a record of the last streak they
-- had, not one they are still on: a player who checked in twelve days
-- running and then vanished in March still carries check_in_streak = 12
-- forever. Reading it straight would put a flame next to people who quit
-- months ago, and the badge would mean nothing.
--
-- So the view derives liveness from last_check_in_on instead, and reports
-- 0 - no badge - for anything staler. Today or yesterday counts as alive:
-- yesterday is still alive because today is not over and they can still
-- come back, and anything before that has already been broken.
--
-- This makes streaks PUBLIC, which is the point of the feature. The
-- leaderboard view already exposes username, display name and avatar
-- across the profiles_select_own policy for exactly the same reason - it
-- is a view, so it runs as its owner rather than as the caller. Nothing
-- else on profiles becomes readable: only the one derived integer below.
--
-- create or replace view can append columns but cannot reorder or remove
-- them, so streak goes on the end. The rest is unchanged from schema.sql.

create or replace view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  coalesce(agg.correct, 0) as correct,
  coalesce(agg.graded, 0) as graded,
  coalesce(pts.total_points, 0) as total_points,
  case
    when p.last_check_in_on >= (now() at time zone 'America/New_York')::date - 1
      then coalesce(p.check_in_streak, 0)
    else 0
  end as streak
from public.profiles p
left join (
  select
    wp.user_id,
    count(*) filter (where wp.team_abbr = gr.winner)::int as correct,
    count(*)::int as graded
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  group by wp.user_id
) agg on agg.user_id = p.id
left join (
  select user_id, sum(points)::int as total_points
  from public.point_events
  group by user_id
) pts on pts.user_id = p.id
where p.username is not null;
