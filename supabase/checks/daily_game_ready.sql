-- Is the daily game's SQL loaded in THIS database, and is it current?
--
-- Read-only and idempotent - safe to run against production as often as
-- you like. Paste the whole file into the Supabase SQL editor.
--
-- Exists because "I think I ran it" is not checkable by looking: a stale
-- copy of the seed leaves every table in place and every function
-- working, and the only symptom is that guessing a backup comes back
-- "Not a player in the pool" - which reads as a bug in the game rather
-- than as a database that is one file behind.

-- 1. The migrations. Each check looks for the thing that migration
--    actually creates, rather than for a version number nobody records.
with base as (select to_regclass('public.puzzle_players') is not null as has_0046)
select
  case when     has_0046 then '0046 ok' else '0046 MISSING' end as m0046,
  case when not has_0046 then '- run 0046 first'
       when exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='puzzle_players' and column_name='answerable')
       then '0047 ok' else '0047 MISSING' end                    as m0047,
  case when to_regclass('public.college_conferences') is not null
       then '0048 ok' else '0048 MISSING' end                    as m0048,
  -- 0049 DROPS puzzle_position_group, so its presence means 0049 has not run.
  case when not has_0046 then '- run 0046 first'
       when to_regprocedure('public.puzzle_position_group(text)') is null
       then '0049 ok' else '0049 MISSING' end                    as m0049,
  case when not has_0046 then '- run 0046 first'
       when exists (select 1 from information_schema.columns
                     where table_schema='public' and table_name='puzzle_players' and column_name='guessable')
       then '0050 ok' else '0050 MISSING' end                    as m0050,
  case when to_regprocedure('public.puzzle_guest_compare(text)') is not null
       then '0051 ok' else '0051 MISSING' end                    as m0051
from base;

-- 2. The seed. This is the one that catches an older copy: the pool went
--    from two starting receivers per team to three, so a stale seed is
--    64 receivers where it should be 96, and every WR3 in the league is
--    unguessable.
select
  count(*) filter (where guessable)                     as guessable,
  count(*) filter (where answerable)                    as answerable,
  count(*) filter (where slot is not null)              as in_rotation,
  count(*) filter (where answerable and position = 'WR') as wr_answers,
  case
    when count(*) filter (where guessable)  <> 925 then 'STALE - re-run supabase/seeds/puzzle_players.sql'
    when count(*) filter (where answerable) <> 192 then 'STALE - re-run supabase/seeds/puzzle_players.sql'
    when count(*) filter (where answerable and position = 'WR') <> 96
         then 'STALE - still on 2 receivers, re-run the seed'
    else 'CURRENT - nothing to do'
  end                                                    as verdict
from public.puzzle_players;
