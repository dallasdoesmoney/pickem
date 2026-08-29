-- Day one is a decision, and a missed day is not a loss.
--
-- ------------------------------------------------------------------
-- 1. WHERE THE COUNT STARTS
-- ------------------------------------------------------------------
-- 0059 derived day one from the earliest row in daily_puzzles, which
-- fixed the strip disagreeing with the stats but answered a different
-- question from the one being asked. The data knows when the game was
-- FIRST PLAYED - 2026-08-24, on preview builds, by the two people
-- building it. It cannot know when the game LAUNCHED, because that is
-- not a fact about rows.
--
-- So it goes back to a constant, but now there is exactly one of them
-- and both the number and the record read it. That was the actual bug in
-- the first version: not that day one was declared, but that it was
-- declared in the client while the stats counted from the data, so the
-- two could drift and did.
--
-- Boards before this date still exist and are still perfectly good rows.
-- They were the game being tested, some of them with deliberately wrong
-- guesses, and nothing is deleted to make the numbers nicer - they are
-- simply not what the record is about.
create or replace function public.puzzle_epoch()
returns date language sql immutable as $$ select date '2026-08-28' $$;

create or replace function public.puzzle_number(p_on date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  -- Clamped, so a board from the testing days is #1 rather than #-3.
  -- Nothing routes there - no path plays a past date - but a negative
  -- board number on a screen would be a worse bug than an off-by-four.
  select greatest(1, (p_on - public.puzzle_epoch())::integer + 1);
$$;

revoke all on function public.puzzle_number(date) from public;
grant execute on function public.puzzle_number(date) to anon, authenticated;

-- ------------------------------------------------------------------
-- 2. A DAY YOU DIDN'T PLAY IS NOT A DAY YOU LOST
-- ------------------------------------------------------------------
-- The win rate never counted them: it is built from puzzle_guesses, so a
-- day nobody opened is not in the denominator. The STREAK did, and that
-- is the change here.
--
-- A streak is now a run of BOARDS PLAYED, not a run of calendar days. It
-- breaks when you play one and do not solve it. It does not break
-- because you were busy on a Tuesday.
--
-- That is deliberately forgiving, and the consequence is worth being
-- honest about: solve Monday, disappear for six months, solve again, and
-- the streak reads 2. The alternative - the Wordle rule - punishes
-- absence, and absence is the thing a daily game is already punished by.
-- You can lose this streak by being wrong. You cannot lose it by having
-- a life.
--
-- Everything else is unchanged from 0058: a board is settled once it can
-- no longer change, an unfinished board from a past day is still a loss,
-- and today's unfinished board is still neither.
create or replace function public.nameplate_stats()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_today date := public.puzzle_today();
  v_from date := public.puzzle_epoch();
  v_max integer := public.puzzle_max_guesses();
  v_out jsonb;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  with
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
       -- The testing days are not part of anybody's record.
       and pg.puzzle_on >= v_from
  ),
  boards as (
    select puzzle_on,
           max(n) as used,
           max(n) filter (where espn_id = answer) as solved_on
      from numbered
     group by puzzle_on
  ),
  settled as (
    select *
      from boards
     where puzzle_on < v_today or solved_on is not null or used >= v_max
  ),
  -- Boards in the order they were played, so a run can be counted over
  -- them without the calendar getting a vote.
  ordered as (
    select puzzle_on, solved_on, row_number() over (order by puzzle_on) as seq
      from settled
  ),
  -- Gaps and islands over SEQ rather than over the date: consecutive
  -- solved boards share (seq - row number) whether they were played on
  -- consecutive days or a month apart.
  islands as (
    select puzzle_on, seq, seq - row_number() over (order by seq) as run
      from ordered
     where solved_on is not null
  ),
  runs as (
    select run, count(*)::integer as len, max(seq) as last_seq
      from islands
     group by run
  )
  select jsonb_build_object(
    'played', (select count(*) from settled),
    'won', (select count(*) from settled where solved_on is not null),
    'winRate', (
      select case when count(*) = 0 then null
                  else count(*) filter (where solved_on is not null)::numeric / count(*)
             end
        from settled
    ),
    'avgGuesses', (select avg(solved_on) from settled where solved_on is not null),
    -- The run that is still going: it has to include the most recently
    -- settled board. If that board was a loss, there is no run going.
    -- Today's board, while it is still being played, is not settled and
    -- so cannot end a streak - only finishing it badly can.
    'currentStreak', coalesce((
      select len from runs
       where last_seq = (select max(seq) from ordered)
       limit 1
    ), 0),
    'maxStreak', coalesce((select max(len) from runs), 0),
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
    'solvedToday', exists (
      select 1 from settled where puzzle_on = v_today and solved_on is not null
    ),
    'maxGuesses', v_max
  ) into v_out;

  return v_out;
end;
$$;

revoke all on function public.nameplate_stats() from public;
grant execute on function public.nameplate_stats() to authenticated;
