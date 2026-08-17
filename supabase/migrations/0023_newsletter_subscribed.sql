-- Tracks whether this account has been pushed to the Beehiiv newsletter
-- list yet, so the one-time signup subscribe (see useAuth.tsx's
-- resolveSession) never fires twice for the same account. Left false on
-- failure so it naturally retries on the next session load, same
-- philosophy as the referral-claim retry already in resolveSession.

alter table public.profiles add column newsletter_subscribed boolean not null default false;
grant update (newsletter_subscribed) on public.profiles to authenticated;
