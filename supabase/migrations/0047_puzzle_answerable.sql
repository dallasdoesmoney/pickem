-- Open the guess list to every active player, while keeping the ANSWER
-- to players people can actually name.
--
-- Two pools, not one:
--
--   guessable   every player on a 53-man roster, ~1,700
--   answerable  the ones ESPN's depth chart mentions, ~400-600
--
-- Guessing stays wide open because being told "not a player" after typing
-- a real name is the most annoying thing these games do. Answering does
-- not, because an answer pool of everybody includes third-string guards
-- and practice-squad safeties, and no set of hints rescues a player
-- nobody can name. Poeltl and Weddle draw the same line.
--
-- The enforcement is `slot`, not a check inside ensure_daily_puzzle:
-- slots are the running order the daily pick walks, so a player without
-- one can never come up. The seed only hands slots to answerable rows.
--
-- Defaults to true so the rows already seeded - all of them depth-chart
-- picks from the five position files - keep their slots and today's
-- puzzle does not move.

alter table public.puzzle_players
  add column if not exists answerable boolean not null default true;

-- Belt and braces on top of "only answerable rows get slots". If a slot
-- ever did land on a guess-only player, this is what stops them being
-- served rather than leaving it to the seed script having been run
-- correctly.
create or replace function public.ensure_daily_puzzle(p_on date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_slot integer;
  v_id text;
begin
  select espn_id into v_id from public.daily_puzzles where puzzle_on = p_on;
  if v_id is not null then
    return v_id;
  end if;

  select count(*) into v_count from public.puzzle_players where slot is not null and answerable;
  if v_count = 0 then
    raise exception 'No answerable puzzle players seeded - run scripts/gen-puzzle-seed.mjs and load supabase/seeds/puzzle_players.sql';
  end if;

  v_slot := ((p_on - date '2026-01-01') % v_count + v_count) % v_count + 1;
  select espn_id into v_id from public.puzzle_players where slot = v_slot and answerable;

  -- Slots can have gaps - a player who left the depth chart keeps theirs
  -- rather than having it reclaimed, because reclaiming would shift every
  -- later day. Step forward to the next answerable one.
  if v_id is null then
    select espn_id into v_id
      from public.puzzle_players
     where slot >= v_slot and answerable
     order by slot
     limit 1;
  end if;
  if v_id is null then
    select espn_id into v_id
      from public.puzzle_players
     where slot is not null and answerable
     order by slot
     limit 1;
  end if;

  insert into public.daily_puzzles (puzzle_on, espn_id)
  values (p_on, v_id)
  on conflict (puzzle_on) do nothing;

  select espn_id into v_id from public.daily_puzzles where puzzle_on = p_on;
  return v_id;
end;
$$;

revoke all on function public.ensure_daily_puzzle(date) from public;
