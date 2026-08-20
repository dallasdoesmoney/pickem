-- Tracks whether this account has been shown the creator follow
-- recommendations, so the modal appears exactly once. Same shape and same
-- reasoning as onboarding_avatar_prompted.
--
-- Defaulting to false is what performs the backfill: every account that
-- already exists is, by definition, "not yet prompted", so they all pick
-- the modal up on their next visit with no campaign, no script and no
-- separate code path. The modal itself reads created_at to decide whether
-- to open with the onboarding step counter or the NEW badge.
--
-- No RPC needed for the recommendations themselves - user_badges,
-- creator_links, follows and the leaderboard view are all already
-- publicly selectable, so the whole query runs client-side against reads
-- that exist.
alter table public.profiles
  add column if not exists follow_recs_prompted boolean not null default false;

-- Same client-writable posture as the avatar flag: dismissing the prompt
-- is the user's own action on their own row, and the worst a tampering
-- client can do is skip a suggestion aimed at itself.
grant update (follow_recs_prompted) on public.profiles to authenticated;
