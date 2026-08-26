-- Classic mode: the four skill positions, off the top of the chart.
--
-- QB, RB and TE starters, plus every WR the depth chart ranks first or
-- second. About 200 players, and they are BOTH the answers and the only
-- names that can be guessed - classic draws no distinction between the
-- two, so being told "not a player" after typing a real name cannot
-- happen.
--
-- The rest of the roster STAYS. Every one of the ~3,000 rows keeps its
-- place in puzzle_players, and hard mode will widen back out to them; the
-- only thing that changes is which of them are flagged. Deleting them
-- would mean another trip to ESPN to get them back, and would break the
-- foreign key from any daily_puzzles row that already used one.
--
-- Which is why `guessable` is a column of its own rather than a reuse of
-- `answerable`. In classic they hold the same value, and there would be
-- no way to tell that from the schema - but hard mode is precisely where
-- they come apart, and the schema should not need changing again for it.

alter table public.puzzle_players
  add column if not exists guessable boolean not null default true;

-- The guess check, now against `guessable` rather than mere existence.
-- Without this the pool is only narrowed in the dropdown, and the
-- dropdown is not a security boundary: the RPC is callable directly, so
-- the rule has to be enforced where the guess is recorded.
create or replace function public.submit_daily_guess(p_espn_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_on date := public.puzzle_today();
  v_answer text;
  v_used integer;
  v_max integer := public.puzzle_max_guesses();
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  v_answer := public.ensure_daily_puzzle(v_on);

  if not exists (select 1 from public.puzzle_players where espn_id = p_espn_id and guessable) then
    raise exception 'Not a player in the pool';
  end if;

  -- Lock this player's row for the day before counting, so two guesses
  -- fired at once cannot both see "7 used" and take the total to 9.
  perform 1 from public.daily_puzzles where puzzle_on = v_on for update;

  select count(*) into v_used
    from public.puzzle_guesses
   where user_id = v_uid and puzzle_on = v_on;

  if exists (
    select 1 from public.puzzle_guesses
     where user_id = v_uid and puzzle_on = v_on and espn_id = v_answer
  ) then
    raise exception 'Already solved today';
  end if;
  if v_used >= v_max then
    raise exception 'No guesses left today';
  end if;
  -- Said out loud rather than left to the unique index below. The index
  -- absorbs a repeat with on conflict do nothing, which is safe - no
  -- guess is spent - but from the outside it is a button that does
  -- nothing and says nothing. The client greys out names already played;
  -- this is what it gets if that ever fails to hold.
  if exists (
    select 1 from public.puzzle_guesses
     where user_id = v_uid and puzzle_on = v_on and espn_id = p_espn_id
  ) then
    raise exception 'You already guessed that player today';
  end if;

  insert into public.puzzle_guesses (user_id, puzzle_on, espn_id)
  values (v_uid, v_on, p_espn_id)
  on conflict (user_id, puzzle_on, espn_id) do nothing;

  -- Points land here rather than in a sync_ function because this is the
  -- only moment that knows how many guesses it took. reference_id is the
  -- date, so the unique index makes a second payout impossible.
  if p_espn_id = v_answer then
    insert into public.point_events (user_id, source, points, reference_id)
    values (v_uid, 'daily_puzzle', public.puzzle_points(v_used + 1), v_on::text)
    on conflict (user_id, source, reference_id) do nothing;
  end if;

  return public.daily_puzzle_state();
end;
$$;

revoke all on function public.submit_daily_guess(text) from public;
grant execute on function public.submit_daily_guess(text) to authenticated;
