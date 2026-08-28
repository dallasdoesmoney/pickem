-- Unlimited mode: the same game, as many times as you like.
--
-- The daily is one player a day, recorded, paid and streaked. Unlimited
-- is the same board and the same grading with none of that attached, so
-- somebody who wants a fifth round can have one without the daily losing
-- what makes it a daily.
--
-- WHY THE BROWSER PICKS THE ANSWER AND SENDS IT BACK.
--
-- The daily's answer is server-side for two reasons: a client that can
-- see today's player has no puzzle, and there is a payout riding on it.
-- Neither survives into practice. Nothing here is recorded, nothing is
-- paid, and the only person a spoiled practice round costs anything is
-- whoever went digging for it - the reward for which is that they no
-- longer have a puzzle.
--
-- What that buys is everything this would otherwise need: no run table,
-- no session to expire, no row per round somebody abandoned after two
-- guesses, no cleanup job for them, and a signed-out player who can play
-- exactly as freely as an account.
--
-- WHAT IS NOT GIVEN UP IS THE GRADING. This calls puzzle_compare, the
-- same function submit_daily_guess calls, so a yellow in unlimited means
-- precisely what a yellow means in the daily. Grading it in TypeScript
-- instead would have been less work today and would have drifted the
-- first time a band was retuned - which has already happened twice, in
-- 0048 and 0049.
--
-- IT REVEALS NOTHING ABOUT TODAY. The caller supplies both sides, so an
-- answer from this is a fact about two players and carries no
-- information about the date. Walking the pool against it tells you how
-- two players compare, which is what the board already shows you.
create or replace function public.puzzle_practice_compare(p_guess text, p_answer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Same gate as the daily and the guest path: the pool you may guess
  -- from is one rule in one place, so "not a player" means the same
  -- thing in every mode.
  if not exists (select 1 from public.puzzle_players where espn_id = p_guess and guessable) then
    raise exception 'Not a player in the pool';
  end if;

  -- And the answer has to come from the ANSWER pool, the way the daily's
  -- does. Without this a client could set itself a round whose answer is
  -- a third-string long snapper - unsolvable, and not the game anybody
  -- thinks they are playing.
  if not exists (select 1 from public.puzzle_players where espn_id = p_answer and answerable) then
    raise exception 'Not an answer in the pool';
  end if;

  return public.puzzle_compare(p_guess, p_answer);
end;
$$;

-- Callable by a guest, because unlimited is the mode most likely to be
-- somebody's first minute on the site.
revoke all on function public.puzzle_practice_compare(text, text) from public;
grant execute on function public.puzzle_practice_compare(text, text) to anon, authenticated;
