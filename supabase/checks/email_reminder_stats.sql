-- Did the pick reminder actually work?
--
-- Read-only. Safe against production.
--
-- WHY THIS EXISTS RATHER THAN AN OPEN RATE. Apple Mail Privacy
-- Protection has been fetching tracking pixels on its users' behalf
-- since iOS 15, whether or not anybody read the message, and it is on by
-- default. On a consumer audience that inflates opens to somewhere
-- between meaningless and comical. What is measured below cannot be
-- faked by a privacy proxy: the person we wrote to went and finished
-- their card afterwards.

-- 1. Per week: who we told, and what they did next.
select
  s.reference_id                                            as week,
  count(*)                                                  as emailed,
  round(avg(s.picks_at_send), 1)                            as avg_picks_when_emailed,
  count(*) filter (where later.n > 0)                        as picked_after_email,
  round(100.0 * count(*) filter (where later.n > 0) / nullif(count(*), 0)) || '%' as acted
from public.email_sends s
left join lateral (
  select count(*) as n
    from public.weekly_picks wp
   where wp.user_id = s.user_id
     and wp.week = s.reference_id::integer
     -- Created OR updated after we wrote: changing a pick counts as
     -- coming back, and a card started before the email and finished
     -- after it is exactly the case this is trying to see.
     and greatest(wp.created_at, wp.updated_at) > s.sent_at
) later on true
where s.kind = 'weekly_deadline'
group by s.reference_id
order by s.reference_id::integer;

-- 2. How many people have the reminder turned on at all. A conversion
--    rate on a denominator of four is a number to ignore, and this is
--    what tells you when it stops being one.
select
  count(*)                                        as accounts,
  count(*) filter (where weekly_deadline)         as opted_in,
  round(100.0 * count(*) filter (where weekly_deadline) / nullif(count(*), 0)) || '%' as share
from public.email_prefs;

-- 3. The raw log, newest first - one row per person per week, with the
--    provider's message id so any of these can be traced in Resend's own
--    dashboard for delivery, bounce and complaint.
select s.sent_at, p.username, s.reference_id as week, s.picks_at_send, s.provider_message_id
  from public.email_sends s
  join public.profiles p on p.id = s.user_id
 where s.kind = 'weekly_deadline'
 order by s.sent_at desc
 limit 50;
