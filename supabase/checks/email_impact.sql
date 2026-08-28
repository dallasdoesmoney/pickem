-- Did the pick reminders actually help?
--
-- Paste into the Supabase SQL editor. Read-only - it writes nothing.
--
-- WHAT THIS CAN AND CANNOT TELL YOU. Section 1 is descriptive: it says
-- how many picks people made after we wrote to them. That is a real
-- number and it is useful, but it is NOT proof the email caused
-- anything - plenty of those people would have finished their card
-- anyway, reminder or no reminder.
--
-- Section 2 is the part that can actually answer the question, and it
-- only has data if the holdout is switched on (HOLDOUT_PERCENT in the
-- workflow). A holdout is a slice of people who were eligible for the
-- reminder and deliberately did not get one; comparing their finish
-- rate against everyone else's is the only way to separate "the email
-- worked" from "these were the people who were going to finish".
--
-- Why there is no timestamp anywhere in here. The obvious design would
-- compare each pick's created_at against the send time. It cannot be
-- done: saveWeeklyPicks deletes and re-inserts the whole week on every
-- autosave (src/lib/supabase/picks.ts), so every row's timestamp is
-- rewritten constantly and says nothing about when the pick was made.
-- That is why email_sends.picks_at_send exists - it is the only record
-- of how far along somebody was at the moment we wrote to them, and it
-- cannot be reconstructed after the fact.

-- ============================================================ 1. Sent
-- What went out, and what happened to those cards afterwards.
--
-- finished_after   they now have a full card and did not when we wrote
-- picks_gained     total picks made since the send, across everyone
select
  s.reference_id::integer                                as week,
  s.kind,
  count(*)                                               as sent,
  round(avg(s.picks_at_send), 1)                         as avg_picks_when_sent,
  count(*) filter (where s.picks_at_send = 0)            as had_nothing_picked,
  count(*) filter (where now_picks.n > s.picks_at_send)  as picked_more_since,
  sum(greatest(now_picks.n - s.picks_at_send, 0))        as picks_gained,
  round(
    100.0 * count(*) filter (where now_picks.n > s.picks_at_send) / nullif(count(*), 0),
    1
  )                                                      as pct_who_picked_more
from public.email_sends s
left join lateral (
  select count(*)::integer as n
    from public.weekly_picks wp
   where wp.user_id = s.user_id
     and wp.week = s.reference_id::integer
) now_picks on true
where s.kind in ('weekly_deadline', 'weekly_deadline_final')
group by 1, 2
order by 1 desc, 2;

-- ====================================================== 2. vs holdout
-- The comparison that means something. Empty until the holdout is on.
--
-- Both groups were eligible for the same reminder in the same week; the
-- only difference is that one got an email and one did not. If the
-- emailed group finishes at a meaningfully higher rate, the reminder is
-- doing work. If the two rates sit on top of each other, it is not, and
-- you are spending sending reputation for nothing.
--
-- Read the group sizes before the percentages. With a small list these
-- are tiny numbers, and 2 of 3 versus 1 of 3 is not a result - it is
-- noise wearing a percentage sign. Give it several weeks.
with outcome as (
  select
    s.reference_id::integer as week,
    case when s.kind = 'weekly_deadline_holdout' then 'no email (holdout)' else 'emailed' end as grp,
    s.picks_at_send,
    (select count(*) from public.weekly_picks wp
      where wp.user_id = s.user_id and wp.week = s.reference_id::integer) as final_picks
  from public.email_sends s
  where s.kind in ('weekly_deadline', 'weekly_deadline_holdout')
)
select
  week,
  grp,
  count(*)                                                  as people,
  round(avg(picks_at_send), 1)                              as avg_picks_when_decided,
  round(avg(final_picks), 1)                                as avg_picks_now,
  round(avg(final_picks - picks_at_send), 2)                as avg_picks_gained,
  count(*) filter (where final_picks > picks_at_send)       as picked_more,
  round(
    100.0 * count(*) filter (where final_picks > picks_at_send) / nullif(count(*), 0),
    1
  )                                                         as pct_picked_more
from outcome
group by 1, 2
order by 1 desc, 2;

-- ======================================================== 3. Delivery
-- Anything with no provider_message_id never reached Resend, which
-- means the send failed and the row should not exist - worth seeing
-- rather than discovering as a gap in section 1.
select
  s.kind,
  count(*)                                            as rows,
  count(*) filter (where s.provider_message_id is null) as missing_message_id,
  min(s.sent_at)                                      as first,
  max(s.sent_at)                                      as latest
from public.email_sends s
group by 1
order by 1;
