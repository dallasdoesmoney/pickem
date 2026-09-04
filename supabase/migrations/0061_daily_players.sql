-- How many people played a daily game today.
--
-- WHY THIS NEEDS A TABLE AT ALL. Signed-in play is already recorded -
-- every guess is a row in puzzle_guesses with the day on it - so counting
-- accounts needs nothing new. But most people who play are not signed in,
-- and puzzle_guest_compare deliberately records NOTHING (see 0051): it
-- grades a guess and forgets it. A count built only from puzzle_guesses
-- would report a fraction of the real number and quietly imply the game
-- is emptier than it is.
--
-- THE UNIT IS A BROWSER, NOT AN ACCOUNT, and that is deliberate rather
-- than a shortcut. It is the only unit both halves share, so:
--   - a guest counts, which is the entire point;
--   - somebody who plays as a guest and then signs up counts ONCE, not
--     twice, because the key never changes underneath them;
--   - the same person on a phone and a laptop counts twice, which is
--     the honest cost of the above and is what every counter like this
--     does.
--
-- WHAT IS STORED: a random opaque string the browser made up, and a
-- date. No account, no name, no email, no IP, no user agent, nothing
-- that identifies a person or follows them anywhere else. The key is
-- generated client-side and never leaves the device except to land here.
--
-- Rows are per-day, so this table is a rolling census rather than a
-- profile: it can say "1,247 people played on the 3rd" and cannot say
-- anything at all about who they were.

create table if not exists public.daily_players (
  -- The puzzle day, in New York, exactly like every other date on this
  -- site - see puzzle_today(). The counter resets when the puzzle does,
  -- which is the only definition of "today" that matches the game.
  played_on date not null,
  -- Opaque, client-generated, and constrained below rather than trusted:
  -- a text column an anonymous caller can write to is a place to dump
  -- junk unless it is told what shape it accepts.
  player_key text not null,
  created_at timestamptz not null default now(),
  primary key (played_on, player_key),
  -- 16-64 characters of hex-ish alphabet. Long enough that two browsers
  -- do not collide, short enough that nobody can use this as free
  -- storage, and narrow enough that nothing interesting fits in it.
  constraint daily_players_key_shape check (player_key ~ '^[a-z0-9]{16,64}$')
);

-- No extra index: counting one day is the only read this table has, and
-- the primary key already leads on played_on, so that count is a range
-- scan over exactly the rows it needs.

alter table public.daily_players enable row level security;

-- NO POLICIES, ON PURPOSE. Nobody reads or writes this table directly:
-- both functions below are security definer, so they are the only doors,
-- and RLS with no policy denies everything else. That means an anonymous
-- caller can add themselves to today's count and cannot enumerate the
-- table, cannot read another day, and cannot delete anything.

-- ---------------------------------------------------------------------
-- Writing
-- ---------------------------------------------------------------------
-- Called once per browser per day, on the FIRST GUESS - not on page
-- load. Opening the page is not playing, and counting opens would fill
-- the number with crawlers and link previews.
--
-- Idempotent by the primary key, so calling it twice, or on every guess,
-- or after a reconnect, cannot double-count. The client only bothers
-- once a day, but correctness does not depend on the client remembering.
create or replace function public.record_daily_play(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Checked here as well as by the constraint, so a bad key is a no-op
  -- rather than an exception on somebody's first guess of the day. A
  -- counter must never be able to break the game it counts.
  if p_key is null or p_key !~ '^[a-z0-9]{16,64}$' then
    return;
  end if;

  insert into public.daily_players (played_on, player_key)
  values (public.puzzle_today(), p_key)
  on conflict (played_on, player_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------
-- Reading
-- ---------------------------------------------------------------------
-- One integer: how many distinct browsers have played today. Public,
-- because the number is going on the front page and there is nothing in
-- it to protect - it is an aggregate over a table whose rows are
-- meaningless individually.
create or replace function public.daily_players_today()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
    from public.daily_players
   where played_on = public.puzzle_today();
$$;

revoke all on function public.record_daily_play(text) from public;
revoke all on function public.daily_players_today() from public;
grant execute on function public.record_daily_play(text) to anon, authenticated;
grant execute on function public.daily_players_today() to anon, authenticated;
