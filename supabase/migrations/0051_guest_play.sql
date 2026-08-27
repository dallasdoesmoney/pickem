-- Let people play before they sign up.
--
-- The daily game used to show a sign-up wall instead of a board, which
-- asks somebody for an account before they have any idea what they are
-- being asked to join. This is the one piece that has to live in the
-- database for that to change: grading a guess needs the day's answer,
-- and the answer is deliberately server-side, so a signed-out client
-- cannot do it alone.
--
-- What this is NOT: it does not record anything, it does not spend a
-- guess, it does not pay points, and it has no idea who is calling. It
-- takes a player and hands back the same comparison a signed-in guess
-- would produce. Everything that makes a guess *count* - the eight-try
-- limit, the once-a-day payout, the streak - still lives behind
-- submit_daily_guess and still needs an account. A guest's guesses are
-- held in their browser and replayed through the real function when they
-- sign up.
--
-- THE TRADE-OFF, stated rather than buried: anyone can call this as often
-- as they like, so anyone determined enough can walk the pool and find
-- today's answer without playing. That was already true of a signed-in
-- player with a script and nothing to lose; what is protected is the
-- record of having solved it, not the secret itself. Spoiling the answer
-- for yourself is a thing you have to go out of your way to do, and the
-- reward for doing it is nothing at all.
create or replace function public.puzzle_guest_compare(p_espn_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_on date := public.puzzle_today();
  v_answer text;
begin
  -- Same gate as the real thing: classic mode draws no distinction
  -- between who can be guessed and who can be the answer, so a guest
  -- gets told "not a player in the pool" for exactly the names a
  -- signed-in player would.
  if not exists (select 1 from public.puzzle_players where espn_id = p_espn_id and guessable) then
    raise exception 'Not a player in the pool';
  end if;

  -- Resolves the day, creating the row if this is the first play of the
  -- day - which a guest is now allowed to be. The pick is deterministic
  -- from the date either way, so a guest opening the page first cannot
  -- change what anybody else gets.
  v_answer := public.ensure_daily_puzzle(v_on);

  return public.puzzle_compare(p_espn_id, v_answer);
end;
$$;

revoke all on function public.puzzle_guest_compare(text) from public;
grant execute on function public.puzzle_guest_compare(text) to anon, authenticated;
