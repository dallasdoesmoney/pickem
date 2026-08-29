-- Which board this is, counted from the data rather than from a constant.
--
-- WHY THIS EXISTS. The strip across the top of Nameplate numbered days
-- from a date hard-coded in the client - the day the game merged to main
-- - which was a guess about when day one was, and it was wrong. The game
-- had been played on preview builds against this same database for days
-- before that, so the strip said "#3" on a board whose own stats, which
-- derive from the guesses, counted six. One of the two was reading the
-- data and the other was reading my assumption.
--
-- So there is no assumption any more. daily_puzzles gets a row the first
-- time anybody plays a given day and never any other way - see
-- ensure_daily_puzzle, which only ever inserts the date it was handed,
-- and every caller hands it puzzle_today(). The earliest row in it IS
-- the first board that ever existed.
--
-- CALENDAR DAYS, not boards played. If nobody opened the game on a
-- Tuesday there is no row for that Tuesday, and Wednesday is still the
-- day after Monday. Numbering by rows instead would renumber the whole
-- history the first time an old date got played, and would let two
-- players call the same board different things.
create or replace function public.puzzle_number(p_on date)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  -- Before anybody has played anything at all, today is board one.
  select coalesce((p_on - (select min(puzzle_on) from public.daily_puzzles))::integer, 0) + 1;
$$;

-- A guest sees the number too, and a guest makes no other call on load.
revoke all on function public.puzzle_number(date) from public;
grant execute on function public.puzzle_number(date) to anon, authenticated;

-- Handed back with the board, so a signed-in player needs no second
-- round trip - and so the number and the guesses it numbers can never be
-- read at two different moments.
--
-- Unchanged from 0046 apart from the one added field. submit_daily_guess
-- ends with `return public.daily_puzzle_state()`, so it picks this up
-- without being touched: rewriting it to add a field would have meant
-- restating its points insert and its four error messages from memory,
-- and a first attempt at exactly that got all of them wrong.
create or replace function public.daily_puzzle_state()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_on date := public.puzzle_today();
  v_answer text;
  v_max integer := public.puzzle_max_guesses();
  v_rows jsonb;
  v_used integer;
  v_solved boolean;
  v_finished boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  v_answer := public.ensure_daily_puzzle(v_on);

  select coalesce(jsonb_agg(public.puzzle_compare(pg.espn_id, v_answer) order by pg.created_at), '[]'::jsonb),
         count(*)
    into v_rows, v_used
    from public.puzzle_guesses pg
   where pg.user_id = v_uid and pg.puzzle_on = v_on;

  v_solved := exists (
    select 1 from public.puzzle_guesses
     where user_id = v_uid and puzzle_on = v_on and espn_id = v_answer
  );
  v_finished := v_solved or v_used >= v_max;

  return jsonb_build_object(
    'puzzleOn', v_on,
    'puzzleNumber', public.puzzle_number(v_on),
    'maxGuesses', v_max,
    'guessesUsed', v_used,
    'guesses', v_rows,
    'solved', v_solved,
    'finished', v_finished,
    'pointsAwarded', case when v_solved then public.puzzle_points(v_used) else 0 end,
    'answer', case
      when v_finished then (
        select jsonb_build_object('espnId', espn_id, 'name', name, 'team', team, 'position', position)
          from public.puzzle_players where espn_id = v_answer
      )
      else null
    end
  );
end;
$$;

revoke all on function public.daily_puzzle_state() from public;
grant execute on function public.daily_puzzle_state() to authenticated;
