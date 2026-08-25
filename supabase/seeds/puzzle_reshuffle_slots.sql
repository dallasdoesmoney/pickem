-- One-time: reshuffle the daily puzzle's running order.
--
-- Run this ONCE, right after loading puzzle_players.sql, when the answer
-- pool has been WIDENED (ANSWER_MAX_DEPTH_RANK went up). Do not make it
-- part of the routine sync.
--
-- Why it is needed. puzzle_players.slot is the running order
-- ensure_daily_puzzle walks, one slot per day, and the seed only ever
-- appends: new players get slots on the END so the days already
-- scheduled do not move. That is right for a weekly roster sync, where a
-- handful of players change. It is wrong for a pool that just went from
-- 775 to 1,441, because the walk is only a couple of hundred days in -
-- slots 776 and up would not come round until 2028, and the wider pool
-- would look like it did nothing.
--
-- Why it is safe. ensure_daily_puzzle returns the daily_puzzles row for
-- a date if one exists, and only picks a slot when it does not. So every
-- day that has ALREADY been served keeps the answer it was served -
-- reshuffling can only change dates nobody has played yet.
--
-- Two statements rather than one because slot is `integer unique`, and a
-- single UPDATE that permutes the values trips the constraint on the way
-- through even though the end state is fine.

-- 1. Clear the order. This also takes the slot away from anyone who is
--    no longer answerable; their row stays, so a date that already used
--    them still resolves.
update public.puzzle_players
   set slot = null
 where slot is not null;

-- 2. Deal a fresh random order across everyone eligible. Random so the
--    sequence is not alphabetical and not grouped by team.
update public.puzzle_players
   set slot = sub.next_slot
  from (
    select espn_id, row_number() over (order by random()) as next_slot
      from public.puzzle_players
     where answerable
  ) sub
 where public.puzzle_players.espn_id = sub.espn_id;

-- Expect 1441 with the pool at depth rank <= 2.
select count(*) filter (where slot is not null) as in_rotation,
       count(*) filter (where answerable)       as answerable,
       count(*)                                 as players
  from public.puzzle_players;
