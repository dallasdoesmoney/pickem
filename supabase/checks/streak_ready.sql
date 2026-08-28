-- Why is the streak pop-up not showing?
--
-- Paste into the Supabase SQL editor. Read-only - it writes nothing and
-- it does not claim a check-in.
--
-- WHAT ACTUALLY HAPPENS ON A PAGE LOAD. NotificationToasts mounts inside
-- NavShell, so it runs on every page, and it calls daily_check_in() once
-- per load. The function is the only thing that decides anything: the
-- date comes from the database clock and the once-a-day rule from a
-- unique index, because a client that can name the day can claim a year
-- of them.
--
-- Then the RESULT decides which surface you see, and this is the part
-- that surprises people:
--
--   awarded = false   nothing at all. This is the normal case on every
--                     load after the first one of the day.
--   streak <= 1       the full-screen StreakRenewedModal - a streak
--                     starting, or the first day back after one broke.
--   streak >= 2       a five-second toast in the corner with the flame
--                     and the count. NOT the pop-up.
--
-- So "the pop-up stopped appearing" is the expected behaviour from day
-- two of a streak onwards. If you are on a run, the toast is what you
-- should be looking for, and it is easy to miss.
--
-- If the RPC itself fails, the client logs "Daily check-in failed" to
-- the browser console and shows NOTHING - no error, no toast. That is
-- the failure this report is really for. Section 4 is the one that
-- separates "the database is not recording" from "it is recording and
-- the browser is not showing it".

-- ================================================== 1. Is it installed
select
  'daily_check_in function' as check_name,
  case when to_regprocedure('public.daily_check_in()') is null
       then 'MISSING - run 0041, then 0042 and 0043'
       else 'ok' end as status
union all
-- The client calls this as a signed-in user, so `authenticated` is the
-- role that needs it. This is exactly the bug that broke the email
-- sender: a function can exist, be correct, and be unreachable.
select
  'signed-in users can call it',
  case when to_regprocedure('public.daily_check_in()') is null then '- function missing'
       when has_function_privilege('authenticated', 'public.daily_check_in()', 'execute')
         then 'ok'
       else 'PERMISSION DENIED for authenticated - re-run 0043' end
union all
select
  'streak columns on profiles',
  case when (select count(*) from information_schema.columns
              where table_schema = 'public' and table_name = 'profiles'
                and column_name in ('check_in_streak','longest_check_in_streak','last_check_in_on')) = 3
       then 'ok' else 'MISSING - run 0041' end
union all
-- The toast is built from a point_events row, so if this source is not
-- being written there is nothing to show.
select
  'point_events table',
  case when to_regclass('public.point_events') is null then 'MISSING - run 0010'
       else 'ok' end;

-- ============================================ 2. What day is it here
-- The day rolls at midnight in NEW YORK, not UTC. If you are testing
-- late at night on the west coast you may already be on tomorrow's date
-- as far as this function is concerned - and already checked in for it.
select
  now()                                             as utc_now,
  (now() at time zone 'America/New_York')::date      as check_in_day,
  to_char(now() at time zone 'America/New_York', 'HH24:MI') as ny_time;

-- ================================== 3. Has it EVER recorded a check-in
-- Zero rows here means the function has never successfully run for
-- anybody - the failure is server-side and the browser console will have
-- "Daily check-in failed" with the reason.
select
  count(*)                                     as check_ins_all_time,
  count(distinct user_id)                      as people,
  max(reference_id)                            as most_recent_day,
  count(*) filter (
    where reference_id = ((now() at time zone 'America/New_York')::date)::text
  )                                            as recorded_today
from public.point_events
where source = 'daily_check_in';

-- ============================================ 4. Who is on a streak
-- The column that decides pop-up versus toast. Anybody with a streak of
-- 2 or more will NOT see the pop-up - by design - and if that is
-- everybody who plays, the pop-up will look broken while working
-- perfectly.
select
  coalesce(nullif(p.display_name, ''), p.username, '(no name)') as who,
  p.check_in_streak                                            as streak,
  p.longest_check_in_streak                                    as longest,
  p.last_check_in_on                                           as last_check_in,
  case when p.check_in_streak <= 1 then 'pop-up' else 'toast only' end as what_they_see
from public.profiles p
where p.last_check_in_on is not null
order by p.last_check_in_on desc, p.check_in_streak desc
limit 20;
