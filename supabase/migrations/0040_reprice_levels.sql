-- Repricing the level ladder: GOAT moves from 162,150 to 500,000.
--
-- The old curve was 150*L triangular. A referral is worth 1,000 and is
-- the only uncapped source, so GOAT was 162 referrals - while a PERFECT
-- season of everything the app actually pays for (all 18 cards, all 18
-- locks, all 32 predictor teams) came to 7,900 points. The ladder was a
-- recruiting leaderboard, and no ceiling on its own fixes that; this is
-- the half of the fix that can ship before the earning side exists.
--
-- Nothing is stored, so nothing migrates. Level is computed from a sum
-- over point_events every time it is asked for, both here and in
-- src/lib/levels.ts - which is why this file only replaces a function.
-- Everyone's points are untouched and simply land on the new ladder.
--
-- And this is not "harder" everywhere. The crossover is between All-Pro
-- and MVP: under about 110,000 points every player comes out at the same
-- rank or a better one, because the early ranks got substantially
-- cheaper. Only the very top gets further away.
--
-- MUST stay in step with cumulativeForLevel() in src/lib/levels.ts. The
-- two are read in different places - the app draws the ladder, this
-- decides when a level_up notification fires - and if they disagree,
-- someone is congratulated for a level the page does not show them.

-- Cost to reach a given level, 1-50. Ten ranks of five sub-levels: a
-- rank's entry cost is a fixed rung, and its five sub-levels climb
-- geometrically from that rung toward the next rank's.
create or replace function public.points_for_level(lvl integer)
returns integer
language plpgsql
immutable
as $$
declare
  -- Entry cost per rank, in RANKS order. Practice Squad is non-zero so
  -- that a player with no points is unranked rather than level 1.
  entry constant integer[] := array[100, 500, 2000, 6000, 15000, 32500, 65000, 125000, 250000, 500000];
  max_points constant integer := 1000000; -- GOAT V
  rank_i integer;
  step_i integer;
  from_p integer;
  to_p integer;
  span integer;
begin
  if lvl <= 0 then
    return 0;
  end if;
  -- Postgres arrays are 1-based; rank_i is the 1-based rank index.
  rank_i := least((lvl - 1) / 5, 9) + 1;
  step_i := (lvl - 1) % 5;
  from_p := entry[rank_i];

  if step_i = 0 then
    return from_p;
  end if;

  if rank_i = 10 then
    -- The last rank has no next rank to run toward, so it lands ON the
    -- ceiling rather than approaching it: GOAT V is exactly max_points.
    to_p := max_points;
    span := 4;
  else
    to_p := entry[rank_i + 1];
    span := 5;
  end if;

  return round(from_p * power(to_p::numeric / from_p::numeric, step_i::numeric / span::numeric));
end;
$$;

-- Still a loop rather than inverting the curve, for the same reason as
-- before: no floating-point rounding can land a player on the wrong side
-- of a threshold if every threshold is computed the same way going up.
create or replace function public.level_for_points(total_points integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl integer := 0;
begin
  while lvl < 50 and total_points >= public.points_for_level(lvl + 1) loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end;
$$;
