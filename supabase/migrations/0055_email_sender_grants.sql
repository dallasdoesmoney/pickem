-- Let the sender actually call the two functions written for it.
--
-- THE BUG. 0052 and 0054 finish each function with
--
--   revoke all on function ... from public, anon, authenticated;
--
-- and never grant anything back. That does not lock the function down to
-- the token check inside it - it welds the door shut. The reminder job
-- reaches PostgREST with the anon key, so it arrives as the `anon` role,
-- and the first real run failed with
--
--   401 {"code":"42501","message":"permission denied for function
--        weekly_deadline_recipients"}
--
-- mark_emails_sent has the identical defect and would have failed on the
-- very next line, after the recipients call was fixed.
--
-- Every other security-definer function in this schema pairs the revoke
-- with a grant. 0039, which is the same shape as these - a token checked
-- inside a security definer function, called by a GitHub Action through
-- PostgREST - reads:
--
--   revoke all on function public.sync_game_results(text, jsonb) from public;
--   grant execute on function public.sync_game_results(text, jsonb) to anon, authenticated;
--
-- This makes 0052 and 0054 match that.
--
-- WHY GRANTING TO anon IS NOT A HOLE. EXECUTE only buys the right to
-- attempt the call. Both functions read sync_secrets.token as their
-- first act and `raise exception 'Not authorized'` unless the caller
-- passed the matching secret, so a stranger with the publishable anon
-- key gets an exception rather than a recipient list. The token is the
-- lock; the grant is just the handle on the door. Revoking EXECUTE as
-- well is not defence in depth, it is a second lock with no key cut for
-- it - which is precisely what happened.
--
-- HOW THIS GOT PAST TESTING, because the lesson is the reusable part.
-- These functions were verified against a scratch Postgres and behaved
-- correctly: right recipients, no repeats, mistyped kind rejected. That
-- test ran as the database OWNER, and an owner bypasses EXECUTE checks
-- entirely - so every permission bug in the file was invisible to it.
-- Testing a security-definer function as its owner tests the logic and
-- nothing about who is allowed to reach it. Reproduced this time by
-- creating anon and authenticated in the scratch database and running
-- `set role anon` first, which fails before the fix and passes after.

revoke all on function public.weekly_deadline_recipients(text, integer, integer, text) from public;
grant execute on function public.weekly_deadline_recipients(text, integer, integer, text) to anon, authenticated;

revoke all on function public.mark_emails_sent(text, text, text, jsonb) from public;
grant execute on function public.mark_emails_sent(text, text, text, jsonb) to anon, authenticated;

-- Not re-granted here on purpose: email_unsubscribe already got its
-- grant in 0052 and is the one function in that file that was right.
