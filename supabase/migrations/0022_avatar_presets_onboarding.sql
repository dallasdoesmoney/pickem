-- Tracks whether AvatarPromptGate (the skippable "add a photo" step right
-- after claiming a username) has already been shown/dismissed, so it
-- never nags twice. Additive column grant - Postgres column privileges
-- are cumulative, so this doesn't disturb the existing grant on
-- display_name/avatar_url/username/migrated_local_picks.

alter table public.profiles add column onboarding_avatar_prompted boolean not null default false;
grant update (onboarding_avatar_prompted) on public.profiles to authenticated;
