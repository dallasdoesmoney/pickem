-- Pick reminders default ON.
--
-- 0052 shipped this off by default, on the reasoning that a reminder
-- nobody asked for is marketing mail. That reasoning has not changed -
-- this is a deliberate product decision to send by default instead, and
-- it is lawful under CAN-SPAM, which requires a working unsubscribe, an
-- honest From, prompt honouring of opt-outs and a postal address rather
-- than prior consent. All four are in place.
--
-- WHAT THIS DOES NOT CHANGE, and must not. The unsubscribe link still
-- works with no session and no confirmation step, the toggle is still in
-- the account page, and email_unsubscribe() still turns the reminder off
-- for anybody holding a token. Default-on only works if off is genuinely
-- one click - the moment it is not, people stop unsubscribing and start
-- reporting spam, which costs the sending domain rather than the list.
--
-- TWO PLACES OUTSIDE THIS FILE DEPEND ON IT. The reminder's footer no
-- longer claims "you turned this on" - that sentence was true under
-- 0052 and is a lie under this one. And the sign-up form now says
-- reminders are included, because consent that is never mentioned is not
-- much of a disclosure.
--
-- Read the note on deliverability before widening this further: the
-- domain was verified the same day this shipped and has no sending
-- history, and Gmail and Yahoo expect bulk senders to hold complaints
-- under 0.3%. Mail to people who do not recognise the sender is what
-- generates complaints.

-- New accounts from here on.
alter table public.email_prefs alter column weekly_deadline set default true;

-- And everyone who already exists, including the rows 0052 backfilled
-- with false. Anybody who has explicitly turned it OFF between 0052 and
-- now would be switched back on by this - which is the one genuinely
-- unpleasant part of the change, so it is called out rather than hidden.
-- It is safe today only because 0052 has not been live long enough for
-- anyone to have made that choice.
update public.email_prefs set weekly_deadline = true, updated_at = now()
 where weekly_deadline = false;

-- Confirms the state rather than leaving it to be assumed.
select count(*) filter (where weekly_deadline) || ' of ' || count(*) || ' accounts now subscribed'
  from public.email_prefs;
