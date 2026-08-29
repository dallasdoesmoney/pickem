-- Nameplate's record, for a signed-in player.
--
-- NOTHING NEW IS RECORDED. Every guess is already a row in
-- puzzle_guesses with the day and the time it was made, and every day's
-- answer is already a row in daily_puzzles. Between them, what happened
-- on any board this player has ever opened is a fact the database
-- already holds - so this derives, and stores nothing.
--
-- That is not tidiness. A stats table would start counting on the day it
-- shipped and would know nothing about the boards already played; worse,
-- it would be a second copy of a truth that can drift from the first the
-- moment a guess is inserted by any path that forgets to update it.
-- There is exactly one record of what happened here, and it is the
-- guesses.
--
-- WHAT COUNTS AS A LOSS. A board is settled once it can no longer
-- change: solved, out of guesses, or the day is over. An unfinished
-- board from a past day is a loss - abandoning at four guesses must not
-- protect a win rate, or the honest players have the worse number.
-- Today's unfinished board is neither: it is still being played, and it
-- is left out of all of it until midnight in New York.
--
-- OWN STATS ONLY. auth.uid(), not an argument. Making this take a user
-- id would decide, quietly, that how well somebody plays is public - and
-- that is a decision to take on purpose, not as a side effect of the
-- signature. Opening it up later is an argument and an RLS-shaped think;
-- closing it again after people have seen each other's numbers is not.

create or replace function public.nameplate_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.puzzle_today();
  v_max integer := public.puzzle_max_guesses();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  with
  -- Every guess this player has made on a day that has an answer,
  -- numbered in the order it was made. id breaks a tie so the numbering
  -- is deterministic when two guesses share a timestamp.
  numbered as (
    select pg.puzzle_on,
           pg.espn_id,
           dp.espn_id as answer,
           row_number() over (
             partition by pg.puzzle_on order by pg.created_at, pg.id
           ) as n
      from public.puzzle_guesses pg
      join public.daily_puzzles dp on dp.puzzle_on = pg.puzzle_on
     where pg.user_id = v_uid
  ),
  -- One row per board. solved_on is the guess the answer landed on, or
  -- null if it never did.
  boards as (
    select puzzle_on,
           max(n) as used,
           max(n) filter (where espn_id = answer) as solved_on
      from numbered
     group by puzzle_on
  ),
  -- Settled boards only. Today's is excluded while it can still change,
  -- so a win rate does not dip the moment somebody opens a board and
  -- recover when they finish it.
  settled as (
    select *
      from boards
     where puzzle_on < v_today or solved_on is not null or used >= v_max
  ),
  wins as (
    select puzzle_on from settled where solved_on is not null
  ),
  -- Gaps and islands: consecutive solved days share (date - row number),
  -- so grouping on it turns runs of days into runs of rows.
  islands as (
    select puzzle_on,
           puzzle_on - (row_number() over (order by puzzle_on))::integer as run
      from wins
  ),
  runs as (
    select run, count(*)::integer as len, max(puzzle_on) as ended_on
      from islands
     group by run
  )
  select jsonb_build_object(
    'played', (select count(*) from settled),
    'won', (select count(*) from wins),
    -- Left as a fraction; the client decides how to round it, and a
    -- percentage computed in two places is a percentage that disagrees
    -- with itself.
    'winRate', (
      select case when count(*) = 0 then null
                  else count(*) filter (where solved_on is not null)::numeric / count(*)
             end
        from settled
    ),
    -- Over WINS only. Averaging in the boards that ran out would be
    -- averaging in an 8 that was never a solve, which quietly makes
    -- losing look like a slow win.
    'avgGuesses', (select avg(solved_on) from settled where solved_on is not null),
    -- The run that is still going: it has to end today or yesterday.
    -- Yesterday counts because a streak does not break at midnight, it
    -- breaks when a day passes unsolved - so an untouched board this
    -- morning has not cost anybody anything yet.
    'currentStreak', coalesce((
      select len from runs
       where ended_on = v_today or ended_on = v_today - 1
       order by ended_on desc
       limit 1
    ), 0),
    'maxStreak', coalesce((select max(len) from runs), 0),
    -- 1..max, every bucket present even at zero, so the client can draw
    -- the bars without inventing the empty ones.
    'distribution', (
      select jsonb_object_agg(g::text, coalesce(c.n, 0))
        from generate_series(1, v_max) as g
        left join (
          select solved_on, count(*) as n
            from settled
           where solved_on is not null
           group by solved_on
        ) c on c.solved_on = g
    ),
    -- So a caller can say "come back tomorrow" rather than showing a
    -- streak that looks stalled.
    'solvedToday', exists (select 1 from wins where puzzle_on = v_today),
    'maxGuesses', v_max
  ) into v_out;

  return v_out;
end;
$$;

-- Signed in only. There is nothing here for a guest: a guest has no
-- history, because nothing a guest does is written down.
revoke all on function public.nameplate_stats() from public;
grant execute on function public.nameplate_stats() to authenticated;
