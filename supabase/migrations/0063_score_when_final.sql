-- A game counts as soon as it is final, not when the week is published.
--
-- Picks used to stay editable until somebody closed the week by hand, so
-- showing a result the moment it arrived would have been an invitation:
-- see who won, then change your pick. weeks.results_published existed to
-- stop that - it held every result back until a person decided the week
-- was safe to reveal.
--
-- 0062 removed the reason. Every pick now locks at its own kickoff, and
-- game_results only ever gets a row for a game ESPN has called final -
-- which is strictly after kickoff. So by the time a result exists, the
-- pick on it has been frozen for hours. There is nothing left to protect.
--
-- What that flag was costing in the meantime: Thursday night's game
-- finished, the result was in the table, the pick was locked - and every
-- record on the site still read 0-0 for the week, because the week was
-- not published. The scoreboard was lying about a game everybody had
-- already watched.
--
-- So the scoring surfaces stop joining weeks entirely. Each one already
-- joins game_results, which IS the "is this final" test; the weeks join
-- was a second gate on top of it, and it is the one that was wrong.
--
-- THE FLAG STAYS, and still does a job - WeekSwitcher shows a week when
-- it is open OR published, so publishing is what keeps a finished week on
-- the board after it closes. It just no longer decides whether a game
-- counts.

-- ---------------------------------------------------------------------
-- The leaderboard. Same columns in the same order - create or replace
-- cannot reorder or remove them - only the join changes.
-- ---------------------------------------------------------------------
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
  -- The game_results join is the gate now: a row here means the game is
  -- final. No weeks join.
  join public.game_results gr on gr.game_id = wp.game_id
  group by wp.user_id
) agg on agg.user_id = p.id
left join (
  select user_id, sum(points)::int as total_points
  from public.point_events
  group by user_id
) pts on pts.user_id = p.id
where p.username is not null;

-- ---------------------------------------------------------------------
-- Points for correct picks, and the perfect-week bonus.
-- ---------------------------------------------------------------------
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
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.team_abbr = gr.winner
  on conflict (user_id, source, reference_id) do nothing;

  -- A week counts as swept when the number of CORRECT picks in it reaches
  -- the number of games it has - which also implies the card was full, so
  -- there is no separate completeness check to keep in step.
  --
  -- Still safe to pay mid-week: the count only reaches the week's game
  -- count once every game in it is final AND every one of them was right,
  -- so a sweep cannot be awarded early. It just gets awarded on the
  -- Monday night rather than whenever somebody remembered to publish.
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'perfect_week', 1500, wp.week::text
  from public.weekly_picks wp
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
-- The Lock of the Week bonus.
-- ---------------------------------------------------------------------
create or replace function public.sync_lock_bonus()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'lock_correct', 250, wp.week::text || ':' || wp.game_id
  from public.weekly_picks wp
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.is_lock = true
    and wp.team_abbr = gr.winner
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;
grant execute on function public.sync_lock_bonus() to authenticated;

-- ---------------------------------------------------------------------
-- Season-predictor accuracy.
-- ---------------------------------------------------------------------
-- COUPLED TO THE GAME ID FORMAT, unchanged from 0043: season_picks stores
-- (tracked_team, week) and game_results records nobody's opponent, so the
-- only link is the id itself, '{year}-w{week}-{away}-{home}'.
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
