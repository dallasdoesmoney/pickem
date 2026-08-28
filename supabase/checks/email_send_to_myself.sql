-- Send yourself ONE real reminder without mailing everybody else.
--
-- This one WRITES. Read it before running it.
--
-- ============================ WHY YOU CANNOT JUST FLIP DRY_RUN TO FALSE
--
-- The manual test uses window_hours=400 to reach a deadline that is not
-- close. Week 1 is about 300 hours out, so a real send at that window
-- tells everybody their picks lock "Wednesday" - about a game nearly two
-- weeks away. That is confusing but survivable.
--
-- What is NOT survivable is the ledger. email_sends is keyed on
-- (user_id, kind, reference_id) and weekly_deadline_recipients excludes
-- anyone already in it. So a test send now writes a row for all 39
-- people, and when Week 1 ACTUALLY approaches they are all excluded -
-- nobody gets the real reminder, and nothing anywhere reports an error,
-- because from the sender's point of view they were already told.
--
-- One careless dry_run:false burns the first week the feature exists
-- for. Hence this file.
--
-- ================================================== HOW THIS WORKS
--
-- Step 1 parks everyone except you, keeping an exact record of who was
-- on. Step 2 is the real send - only you are eligible, so only you get a
-- ledger row. Step 3 puts everybody back exactly as they were.
--
-- The snapshot is a real table, not a temp one: the SQL editor does not
-- hold a session between runs, and a temp table would vanish between
-- step 1 and step 3, leaving no way to know who to switch back on.
--
-- Restoring from the snapshot rather than setting everyone to true is
-- the point. Some people may have opted OUT deliberately, and blanket
-- re-enabling them would be re-subscribing somebody who asked not to be
-- mailed - which is the one mistake this whole feature cannot afford.

-- ============================================================ STEP 1
-- Park everyone except yourself. Put YOUR email in both places.

create table if not exists public.email_prefs_test_snapshot (
  user_id uuid primary key,
  weekly_deadline boolean not null
);

-- Refuse to run twice: a second snapshot taken while everybody is
-- already parked would record them all as OFF and step 3 would then
-- "restore" the whole list to off, permanently.
do $$
begin
  if exists (select 1 from public.email_prefs_test_snapshot) then
    raise exception 'A snapshot already exists - run step 3 first, or this will restore the wrong state.';
  end if;
end $$;

insert into public.email_prefs_test_snapshot (user_id, weekly_deadline)
select user_id, weekly_deadline from public.email_prefs;

update public.email_prefs
   set weekly_deadline = false, updated_at = now()
 where user_id <> (select id from auth.users where email = 'PUT-YOUR-EMAIL-HERE');

-- Confirm exactly one person is left on, and that it is you.
select u.email, e.weekly_deadline
  from public.email_prefs e
  join auth.users u on u.id = e.user_id
 where e.weekly_deadline;

-- ============================================================ STEP 2
-- Now run the workflow: Actions > Weekly pick reminder > Run workflow
--   dry_run:      FALSE
--   window_hours: 400
--
-- The log should say "1 to tell" and name only you. If it names anybody
-- else, STOP and run step 3.

-- ============================================================ STEP 3
-- Put everybody back exactly as they were. Run this even if the send
-- failed - especially then.

update public.email_prefs e
   set weekly_deadline = s.weekly_deadline, updated_at = now()
  from public.email_prefs_test_snapshot s
 where s.user_id = e.user_id
   and e.weekly_deadline is distinct from s.weekly_deadline;

drop table public.email_prefs_test_snapshot;

-- And clear your own ledger row, so you still get the real Week 1
-- reminder along with everyone else. Same email as above.
delete from public.email_sends
 where kind in ('weekly_deadline', 'weekly_deadline_final')
   and user_id = (select id from auth.users where email = 'PUT-YOUR-EMAIL-HERE');

-- Should be back to the number you started with, and no test rows left.
select count(*) filter (where weekly_deadline) as opted_in,
       count(*)                                as accounts
  from public.email_prefs;
