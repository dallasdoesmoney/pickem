-- Run this in the Supabase SQL Editor once, after Phase 0 setup
-- (project created, Google OAuth configured, email confirmation off,
-- "avatars" storage bucket created as public).

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  username text,
  is_admin boolean not null default false,
  migrated_local_picks boolean not null default false,
  referred_by uuid references auth.users(id),
  onboarding_avatar_prompted boolean not null default false,
  onboarding_referral_prompted boolean not null default false,
  follow_recs_prompted boolean not null default false,
  -- Daily check-in state. Not in the grant list below, deliberately: a
  -- streak a client can write is a streak worth nothing. Only
  -- daily_check_in() sets these, and it is security definer.
  check_in_streak integer not null default 0,
  longest_check_in_streak integer not null default 0,
  last_check_in_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Column-level lockdown: RLS policies below are row-level only (auth.uid()
-- = id), which would otherwise let anyone grant themselves admin via
-- `update profiles set is_admin = true` on their own row. is_admin can
-- only ever be set from the SQL Editor. referred_by is excluded for the
-- same reason as is_admin - it's only ever set by claim_referral() below,
-- never a direct client update, so nobody can backdate/reassign who
-- referred them to farm points for a friend after the fact.
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, username, migrated_local_picks, onboarding_avatar_prompted, follow_recs_prompted) on public.profiles to authenticated;
-- Format + a small server-side profanity backstop matching
-- src/lib/usernamePolicy.ts's client-side list.
alter table public.profiles add constraint profiles_username_format
  check (
    username is null or (
      username ~ '^[a-zA-Z0-9_]{4,20}$'
      and username !~* '(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard|whore|slut|rape|nazi|hitler|pussy)'
    )
  );
create unique index profiles_username_lower_idx on public.profiles (lower(username));
-- display_name isn't unique (unlike username) - just a length cap and the
-- same profanity backstop, matching src/lib/displayNamePolicy.ts.
alter table public.profiles add constraint profiles_display_name_format
  check (
    display_name = '' or (
      char_length(display_name) <= 30
      and display_name !~* '(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard|whore|slut|rape|nazi|hitler|pussy)'
    )
  );
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Security-definer so username availability can be checked across all
-- users without broadening profiles_select_own to expose other rows.
create or replace function public.is_username_available(check_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles where lower(username) = lower(check_username)
  );
$$;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- avatar_url defaults from Google OAuth's profile photo (present in
-- raw_user_meta_data as 'avatar_url' and/or 'picture') when available -
-- EditProfileModal's upload flow can always overwrite it after.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger profiles_set_updated_at
  before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- weeks: which week is open for picking on the public site, and whether
-- that week's results have been published (the future trigger point for
-- a "results are in" email).
create table public.weeks (
  week integer primary key,
  is_open boolean not null default false,
  results_published boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.weeks (week) select generate_series(1, 18);
alter table public.weeks enable row level security;
create policy "weeks_select_all" on public.weeks for select using (true);
create policy "weeks_insert_admin" on public.weeks for insert with check (public.is_admin());
create policy "weeks_update_admin" on public.weeks for update using (public.is_admin());
create policy "weeks_delete_admin" on public.weeks for delete using (public.is_admin());
create trigger weeks_set_updated_at before update on public.weeks
  for each row execute function public.set_updated_at();

-- game_results: one row per game (game_id matches Game.id from src/data/games.ts).
create table public.game_results (
  game_id text primary key,
  week integer not null,
  winner text not null,
  updated_at timestamptz not null default now()
);
create index game_results_week_idx on public.game_results (week);
alter table public.game_results enable row level security;
create policy "game_results_select_all" on public.game_results for select using (true);
create policy "game_results_insert_admin" on public.game_results for insert with check (public.is_admin());
create policy "game_results_update_admin" on public.game_results for update using (public.is_admin());
create policy "game_results_delete_admin" on public.game_results for delete using (public.is_admin());
create trigger game_results_set_updated_at before update on public.game_results
  for each row execute function public.set_updated_at();

-- Run once with your real email to make your account the admin - nobody
-- else can grant this to themselves; it's only settable from here.
-- update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');

-- weekly_picks (one row per pick, not a JSON blob - needed for a future leaderboard)
create table public.weekly_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week integer not null,
  game_id text not null,       -- matches Game.id from src/data/games.ts
  team_abbr text not null,     -- matches TeamAbbr
  is_lock boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week, game_id)
);
create index weekly_picks_user_week_idx on public.weekly_picks (user_id, week);
-- One lock per user per week - the partial index is what actually
-- enforces "at most one," not application code.
create unique index weekly_picks_one_lock_per_week on public.weekly_picks (user_id, week) where is_lock;
alter table public.weekly_picks enable row level security;
create policy "weekly_picks_select_own" on public.weekly_picks for select using (auth.uid() = user_id);
-- Insert/update/delete additionally require the week to be open - a
-- closed week can't be written to even by someone bypassing the app's UI.
create policy "weekly_picks_insert_own" on public.weekly_picks for insert
  with check (auth.uid() = user_id and exists (select 1 from public.weeks w where w.week = weekly_picks.week and w.is_open = true));
create policy "weekly_picks_update_own" on public.weekly_picks for update
  using (auth.uid() = user_id and exists (select 1 from public.weeks w where w.week = weekly_picks.week and w.is_open = true));
create policy "weekly_picks_delete_own" on public.weekly_picks for delete
  using (auth.uid() = user_id and exists (select 1 from public.weeks w where w.week = weekly_picks.week and w.is_open = true));
create trigger weekly_picks_set_updated_at
  before update on public.weekly_picks for each row execute function public.set_updated_at();

-- point_events: append-only ledger of every point-earning action (see
-- src/lib/levels.ts - level is computed from the sum, never stored, so the
-- curve stays free to retune with zero migration). No insert policy for
-- authenticated - every point source ships as its own reviewed feature,
-- not a generic "add points" call any signed-in user could hit directly.
create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  points integer not null,
  reference_id text,
  created_at timestamptz not null default now(),
  unique (user_id, source, reference_id)
);
create index point_events_user_idx on public.point_events (user_id);
alter table public.point_events enable row level security;
create policy "point_events_select_own" on public.point_events for select using (auth.uid() = user_id);

-- user_badges: non-level badges (streak, YouTube member, Creator, etc.) -
-- need real state or manual granting, unlike the computed level badge.
-- Public select (same reasoning as the leaderboard view); most badge
-- keys are still admin/SQL Editor only, except 'creator' which gets a
-- real client-facing writer below (review_creator_request()).
create table public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  awarded_at timestamptz not null default now(),
  unique (user_id, badge_key)
);
alter table public.user_badges enable row level security;
create policy "user_badges_select_all" on public.user_badges for select using (true);
grant select on public.user_badges to anon, authenticated;

-- creator_requests: request a Creator badge (streamers/content makers),
-- reviewed by an admin. Only one live pending request per person at a
-- time - resubmitting after a rejection is fine (the previous row is
-- 'rejected', not 'pending'), but can't queue a second while one's still
-- awaiting review.
create table public.creator_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_url text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
create unique index creator_requests_one_pending_idx on public.creator_requests (user_id) where status = 'pending';
alter table public.creator_requests enable row level security;

create policy "creator_requests_select_own_or_admin" on public.creator_requests for select
  using (auth.uid() = user_id or public.is_admin());

revoke insert on public.creator_requests from authenticated;
grant insert (user_id, content_url, note) on public.creator_requests to authenticated;
create policy "creator_requests_insert_own" on public.creator_requests for insert
  with check (auth.uid() = user_id);
-- No update grant to authenticated at all - status only ever changes via
-- review_creator_request() below, so every approval/rejection is
-- funneled through one auditable, admin-checked path.

-- security definer so it can write user_badges/notifications rows the
-- caller has no direct insert grant on, but only after confirming the
-- caller is actually an admin - the authorization boundary lives here,
-- not in a hidden UI button.
create or replace function public.review_creator_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select user_id into v_user_id from public.creator_requests where id = p_request_id and status = 'pending';
  if v_user_id is null then
    return;
  end if;

  update public.creator_requests
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  if p_approve then
    insert into public.user_badges (user_id, badge_key) values (v_user_id, 'creator') on conflict (user_id, badge_key) do nothing;
    insert into public.notifications (user_id, type, data) values (v_user_id, 'creator_request_approved', '{}'::jsonb);
  end if;
end;
$$;
grant execute on function public.review_creator_request(uuid, boolean) to authenticated;

-- creator_links: social/streaming links a Creator can add to their
-- public profile. Insert is gated on actually holding the 'creator'
-- badge (checked via user_badges); update/delete of your own existing
-- rows doesn't re-check, since there's no "revoke creator" flow yet for
-- that distinction to matter.
create table public.creator_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('twitch', 'youtube', 'twitter', 'instagram', 'tiktok', 'kick', 'website')),
  url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, platform)
);
alter table public.creator_links enable row level security;

create policy "creator_links_select_all" on public.creator_links for select using (true);
grant select on public.creator_links to anon, authenticated;

revoke insert, update, delete on public.creator_links from authenticated;
grant insert (user_id, platform, url) on public.creator_links to authenticated;
grant update (url) on public.creator_links to authenticated;
grant delete on public.creator_links to authenticated;

create policy "creator_links_insert_own_creator" on public.creator_links for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.user_badges where user_id = auth.uid() and badge_key = 'creator')
  );
create policy "creator_links_update_own" on public.creator_links for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "creator_links_delete_own" on public.creator_links for delete
  using (auth.uid() = user_id);

-- leaderboard: same pattern as is_username_available but for a whole
-- aggregated view instead of a scalar - runs as the view owner, so it can
-- read every user's weekly_picks/point_events without broadening their
-- own-row-only RLS, and only ever exposes the columns below. Left join
-- from profiles (not an inner join starting at weekly_picks) so every
-- signed-up user with a username appears, tied at 0-0, even before any
-- results are published or any points exist.
create view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  coalesce(agg.correct, 0) as correct,
  coalesce(agg.graded, 0) as graded,
  coalesce(pts.total_points, 0) as total_points
from public.profiles p
left join (
  select
    wp.user_id,
    count(*) filter (where wp.team_abbr = gr.winner)::int as correct,
    count(*)::int as graded
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  group by wp.user_id
) agg on agg.user_id = p.id
left join (
  select user_id, sum(points)::int as total_points
  from public.point_events
  group by user_id
) pts on pts.user_id = p.id
where p.username is not null;
grant select on public.leaderboard to anon, authenticated;

-- season_picks (team predictor)
create table public.season_picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tracked_team text not null,
  week integer not null,
  predicted_winner text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tracked_team, week)
);
create index season_picks_user_team_idx on public.season_picks (user_id, tracked_team);
alter table public.season_picks enable row level security;
create policy "season_picks_select_own" on public.season_picks for select using (auth.uid() = user_id);
create policy "season_picks_insert_own" on public.season_picks for insert with check (auth.uid() = user_id);
create policy "season_picks_update_own" on public.season_picks for update using (auth.uid() = user_id);
create policy "season_picks_delete_own" on public.season_picks for delete using (auth.uid() = user_id);
create trigger season_picks_set_updated_at
  before update on public.season_picks for each row execute function public.set_updated_at();

-- Awards the flat 50-point "completed a team's full season predictor"
-- achievement (src/data/achievements.ts), idempotently, for every team
-- the caller has fully filled in. Security definer so it can read the
-- caller's own season_picks in bulk and insert into point_events (which
-- has no insert policy for authenticated) without broadening either
-- table's RLS; it only ever acts on auth.uid(), never a caller-supplied
-- user id. Required weeks is hardcoded to 17 (an 18-week season minus the
-- one bye every team gets) rather than read from src/data/games.ts, which
-- this function can't see - keep in sync if the schedule ever gives a
-- team more than one bye.
create or replace function public.sync_predictor_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select auth.uid(), 'predictor_team_complete', 50, sp.tracked_team
  from public.season_picks sp
  where sp.user_id = auth.uid()
  group by sp.tracked_team
  having count(distinct sp.week) >= 17
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;
grant execute on function public.sync_predictor_achievements() to authenticated;

-- tier lists ------------------------------------------------------------
-- A saved, editable list per account per template ("nfl-teams", and
-- whatever gets ranked next), plus immutable public snapshots for
-- sharing. Two tables because the lifecycles are opposite: a tier_lists
-- row keeps changing as its author edits; a tier_list_shares row must
-- never change once created, or everyone holding a link would see later
-- edits instead of what was actually shared.
create table public.tier_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null,
  title text not null,
  -- tiers, placements and unranked order in one blob. Deliberately not
  -- normalised: it's always read and written whole, never queried
  -- across, and tier definitions are user-editable so there's no stable
  -- dimension to join against.
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One saved list per template for now, so Save is a plain upsert.
  -- Dropping this is all that's needed to allow several named lists per
  -- category later.
  unique (user_id, template)
);
create index tier_lists_user_idx on public.tier_lists (user_id, updated_at desc);
alter table public.tier_lists enable row level security;

create policy "tier_lists_select_own" on public.tier_lists for select using (auth.uid() = user_id);
revoke insert, update on public.tier_lists from authenticated;
grant insert (user_id, template, title, state) on public.tier_lists to authenticated;
-- updated_at is not client-settable; the trigger below owns it.
grant update (title, state) on public.tier_lists to authenticated;
grant delete on public.tier_lists to authenticated;
create policy "tier_lists_insert_own" on public.tier_lists for insert with check (auth.uid() = user_id);
create policy "tier_lists_update_own" on public.tier_lists for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "tier_lists_delete_own" on public.tier_lists for delete using (auth.uid() = user_id);

create or replace function public.touch_tier_list_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger tier_lists_touch_updated_at
  before update on public.tier_lists
  for each row execute function public.touch_tier_list_updated_at();

-- Immutable share snapshots. user_id is nullable (you don't need an
-- account to share a list) and `on delete set null` rather than cascade:
-- deleting an account shouldn't break links other people already hold.
create table public.tier_list_shares (
  code text primary key,
  user_id uuid references auth.users(id) on delete set null,
  template text not null,
  title text not null,
  state jsonb not null,
  created_at timestamptz not null default now()
);
create index tier_list_shares_user_idx on public.tier_list_shares (user_id, created_at desc);
alter table public.tier_list_shares enable row level security;

-- Anyone with the link can read it, signed in or not - that's the point.
create policy "tier_list_shares_select_all" on public.tier_list_shares for select using (true);
grant select on public.tier_list_shares to anon, authenticated;
-- No insert/update/delete grant to ANYONE, including authenticated.
-- create_tier_list_share() below is the only writer, and nothing may
-- edit a snapshot after the fact. This is what lets a signed-out
-- visitor create a share link without the table ever accepting a direct
-- anonymous write - same posture as notifications/point_events.

-- Short, unambiguous codes (no 0/o/1/l/i) so they survive being read
-- aloud or retyped off a screenshot.
create or replace function public.gen_tier_share_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_code text;
  v_i integer;
begin
  loop
    v_code := '';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, floor(random() * length(v_alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.tier_list_shares where code = v_code);
  end loop;
  return v_code;
end;
$$;

-- The only writer into tier_list_shares. Validates shape and size first
-- so anonymous sharing can't be used as free unbounded storage.
create or replace function public.create_tier_list_share(p_template text, p_title text, p_state jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if p_template is null or length(p_template) > 40 then
    raise exception 'Invalid template';
  end if;
  if p_state is null or jsonb_typeof(p_state) <> 'object' then
    raise exception 'Invalid state';
  end if;
  if jsonb_typeof(p_state -> 'tiers') <> 'array' or jsonb_array_length(p_state -> 'tiers') > 10 then
    raise exception 'Invalid tiers';
  end if;
  if pg_column_size(p_state) > 20000 then
    raise exception 'State too large';
  end if;

  v_code := public.gen_tier_share_code();
  insert into public.tier_list_shares (code, user_id, template, title, state)
  values (v_code, auth.uid(), p_template, left(coalesce(nullif(trim(p_title), ''), 'Tier List'), 60), p_state);
  return v_code;
end;
$$;
grant execute on function public.create_tier_list_share(text, text, jsonb) to anon, authenticated;


-- Awards the flat 100-point "filled out every game in a week" achievement
-- (src/data/achievements.ts), idempotently, for every week the caller has
-- fully picked. Same security-definer reasoning as
-- sync_predictor_achievements(). Required game counts per week are
-- hardcoded (src/data/games.ts can't be read from SQL) - keep this CASE
-- in sync with GAMES_BY_WEEK if the schedule data ever changes.
-- One place that knows how many games a week has. Perfect Week needs the
-- identical number to decide whether a week was swept, and two copies of
-- a schedule are two copies that can disagree - at which point a swept
-- week silently fails to pay.
create or replace function public.week_game_count(wk integer)
returns integer
language sql
immutable
as $$
  select case wk
    when 1 then 16 when 2 then 16 when 3 then 16 when 4 then 16
    when 5 then 15 when 6 then 14 when 7 then 14 when 8 then 14
    when 9 then 15 when 10 then 14 when 11 then 13 when 12 then 16
    when 13 then 14 when 14 then 15 when 15 then 16 when 16 then 16
    when 17 then 16 when 18 then 16
    else 999
  end;
$$;

create or replace function public.sync_weekly_pickem_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select auth.uid(), 'weekly_pickem_complete', 250, wp.week::text
  from public.weekly_picks wp
  where wp.user_id = auth.uid()
  group by wp.week
  having count(distinct wp.game_id) >= public.week_game_count(wp.week)
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;

-- Being right, as opposed to merely turning up: 25 a correct pick, 1,500
-- for sweeping a week. See 0043_reprice_economy.sql for why these exist.
-- Graded off published weeks only, exactly like sync_lock_bonus.
create or replace function public.sync_correct_picks()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'correct_pick', 25, wp.week::text || ':' || wp.game_id
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.team_abbr = gr.winner
  on conflict (user_id, source, reference_id) do nothing;

  -- A week counts as swept when the number of CORRECT picks reaches the
  -- number of games it has - which also implies the card was full, so
  -- there is no separate completeness check to keep in step.
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'perfect_week', 1500, wp.week::text
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.team_abbr = gr.winner
  group by wp.user_id, wp.week
  having count(distinct wp.game_id) >= public.week_game_count(wp.week)
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;

revoke all on function public.sync_correct_picks() from public;
grant execute on function public.sync_correct_picks() to authenticated;

-- 10 per correct season-predictor call, paid as weeks are published
-- rather than as a season-end lump - there is no "the season is over"
-- trigger to hang one on.
--
-- COUPLED TO THE GAME ID FORMAT. season_picks stores (tracked_team,
-- week); game_results stores (game_id, week, winner) and nowhere records
-- who played whom - the schedule lives in src/data/games.ts, not in the
-- database. The one link is the id itself, '{year}-w{week}-{away}-{home}',
-- so parts 3 and 4 are the two teams. If that format changes this
-- silently stops paying rather than erroring. A games table is the real
-- fix.
create or replace function public.sync_predictor_accuracy()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select sp.user_id, 'predictor_correct', 10, sp.tracked_team || ':' || sp.week::text
  from public.season_picks sp
  join public.weeks w on w.week = sp.week and w.results_published = true
  join public.game_results gr
    on gr.week = sp.week
   and lower(sp.tracked_team) in (split_part(gr.game_id, '-', 3), split_part(gr.game_id, '-', 4))
  where sp.user_id = auth.uid()
    and gr.winner = sp.predicted_winner
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;

revoke all on function public.sync_predictor_accuracy() from public;
grant execute on function public.sync_predictor_accuracy() to authenticated;
grant execute on function public.sync_weekly_pickem_achievements() to authenticated;

-- Awards a bonus for each lock that hit, once results are published.
-- Distinct from sync_weekly_pickem_achievements above (that one rewards
-- completion regardless of correctness; this one only pays out when the
-- locked pick was actually right). Security definer, idempotent via
-- point_events' unique constraint, scans all of the caller's locks each
-- call rather than one week at a time - cheap at this scale and means it
-- doesn't matter which week's results just got published.
create or replace function public.sync_lock_bonus()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select wp.user_id, 'lock_correct', 250, wp.week::text || ':' || wp.game_id
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  where wp.user_id = auth.uid()
    and wp.is_lock = true
    and wp.team_abbr = gr.winner
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;
grant execute on function public.sync_lock_bonus() to authenticated;

-- Points for showing up: opening the site once a day is worth 100,
-- whether or not you touch anything. See 0041_daily_check_in.sql for the
-- design and 0042_check_in_points_100.sql for the current amount.
--
-- Takes NO arguments on purpose. Both "which day is it" and "have I
-- already claimed" are decided here rather than by the caller: a client
-- that can name the day can claim a year of them, and a client that can
-- say "not yet" can claim the same day forever. The day rolls at midnight
-- in New York rather than UTC, which would roll it mid-evening Eastern -
-- right through a Sunday night game.
create or replace function public.daily_check_in()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in step with src/data/achievements.ts's daily_check_in
  -- pointsEach, which is the number the Challenges card promises.
  v_points constant integer := 25;
  v_today date := (now() at time zone 'America/New_York')::date;
  v_uid uuid := auth.uid();
  v_last date;
  v_streak integer;
  v_longest integer;
  v_rows integer;
  v_awarded boolean;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  -- The unique index on (user_id, source, reference_id) is what makes
  -- this once a day, so two tabs opening at the same moment cannot both
  -- score. Nothing reads-then-writes.
  insert into public.point_events (user_id, source, points, reference_id)
  values (v_uid, 'daily_check_in', v_points, v_today::text)
  on conflict (user_id, source, reference_id) do nothing;
  get diagnostics v_rows = row_count;
  v_awarded := v_rows > 0;

  select last_check_in_on, check_in_streak, longest_check_in_streak
    into v_last, v_streak, v_longest
    from public.profiles
    where id = v_uid
    for update;

  if v_awarded then
    if v_last = v_today - 1 then
      v_streak := coalesce(v_streak, 0) + 1;
    else
      v_streak := 1;
    end if;
    v_longest := greatest(coalesce(v_longest, 0), v_streak);

    update public.profiles
      set check_in_streak = v_streak,
          longest_check_in_streak = v_longest,
          last_check_in_on = v_today
      where id = v_uid;
  end if;

  return jsonb_build_object(
    'awarded', v_awarded,
    'points', case when v_awarded then v_points else 0 end,
    'streak', coalesce(v_streak, 0),
    'longest', coalesce(v_longest, 0)
  );
end;
$$;

revoke all on function public.daily_check_in() from public;
grant execute on function public.daily_check_in() to authenticated;

-- 250 points, once ever, for joining the Discord. See
-- 0044_discord_join.sql for the full note; the short version is that
-- this pays for FOLLOWING the invite, not for joining - the app holds no
-- Discord identity for anyone, so there is nothing to check a membership
-- against. What it does guarantee is paying once: the fixed reference_id
-- plus the unique index is the enforcement, not the client.
create or replace function public.claim_discord_join()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  -- Keep in step with src/data/achievements.ts's discord_join pointsEach.
  v_points constant integer := 250;
  v_uid uuid := auth.uid();
  v_rows integer;
begin
  if v_uid is null then
    raise exception 'Not signed in';
  end if;

  -- 'joined' rather than a timestamp or a nonce: the reference_id IS the
  -- once-ness here, so it has to be a value the caller cannot vary.
  insert into public.point_events (user_id, source, points, reference_id)
  values (v_uid, 'discord_join', v_points, 'joined')
  on conflict (user_id, source, reference_id) do nothing;
  get diagnostics v_rows = row_count;

  return jsonb_build_object(
    'awarded', v_rows > 0,
    'points', case when v_rows > 0 then v_points else 0 end
  );
end;
$$;

revoke all on function public.claim_discord_join() from public;
grant execute on function public.claim_discord_join() to authenticated;

-- Attributes a new signup to whoever referred them (by username, doubling
-- as the referral code - no separate code system needed) and pays BOTH
-- sides a flat, deliberately large bonus - the referrer (source
-- 'referral') and the new signup (source 'referral_signup', kept distinct
-- so the two directions stay distinguishable in the ledger). Security
-- definer since referred_by has no client update grant (see profiles
-- above). Claimable exactly once per account: a caller who already has
-- referred_by set is a no-op, which also makes this safe to call
-- speculatively/repeatedly from the client without double-crediting.
-- No-ops on a bad username or a self-referral rather than erroring, since
-- this runs silently in the background after signup - there's no UI
-- waiting on its result.
create or replace function public.claim_referral(p_referrer_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and referred_by is not null) then
    return;
  end if;

  select id into v_referrer_id from public.profiles where lower(username) = lower(p_referrer_username);
  if v_referrer_id is null or v_referrer_id = auth.uid() then
    return;
  end if;

  update public.profiles set referred_by = v_referrer_id where id = auth.uid();

  insert into public.point_events (user_id, source, points, reference_id)
  values
    (v_referrer_id, 'referral', 1000, auth.uid()::text),
    (auth.uid(), 'referral_signup', 1000, v_referrer_id::text)
  on conflict (user_id, source, reference_id) do nothing;

  -- Notifies the referrer that someone joined using their link. data is
  -- kept minimal (just the id) since the referee's profile is likely
  -- still empty at this instant (username is set later, not during
  -- signup) - display info gets resolved live via fetch_my_referrals()
  -- when the notification is actually rendered, not trusted from a
  -- stale snapshot taken here.
  insert into public.notifications (user_id, type, data)
  values (v_referrer_id, 'referral_joined', jsonb_build_object('referee_id', auth.uid()));
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;

-- follows: Twitter-style, one-directional, no approval needed. "Friends"
-- is derived (see the public.friends view below), not its own stored
-- state. Deliberately PUBLIC READ (unlike the old friendships table,
-- which was select-own and needed a security-definer RPC just to show a
-- count on someone else's profile) - follow graphs are public info on
-- platforms like this, same posture as the leaderboard/user_badges views
-- below. Writes stay locked down: insert only as yourself, delete only
-- your own outgoing edge.
create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (follower_id <> followee_id)
);
create unique index follows_unique_edge_idx on public.follows (follower_id, followee_id);
create index follows_followee_idx on public.follows (followee_id, created_at);
alter table public.follows enable row level security;
create policy "follows_select_all" on public.follows for select using (true);
grant select on public.follows to anon, authenticated;
revoke insert on public.follows from authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
-- Each row belongs to exactly one person (the follower) - unfollowing
-- only ever removes your own edge, never the other side's. No update
-- policy: a follow has nothing mutable to change.
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- Mutual pairs, both directions - plain view (not security-definer) is
-- safe here specifically because follows itself already grants
-- unrestricted select.
create view public.friends as
select a.follower_id as user_id, a.followee_id as friend_id, greatest(a.created_at, b.created_at) as became_friends_at
from public.follows a
join public.follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id;
grant select on public.friends to anon, authenticated;

-- Notifies the followee, stamping is_mutual so the client can render
-- "followed you back - you're now friends!" without a second
-- notification type or a live re-resolution step.
create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_mutual boolean;
begin
  v_is_mutual := exists (
    select 1 from public.follows
    where follower_id = new.followee_id and followee_id = new.follower_id
  );
  insert into public.notifications (user_id, type, data)
  values (new.followee_id, 'new_follower', jsonb_build_object('follower_id', new.follower_id, 'is_mutual', v_is_mutual));
  return new;
end;
$$;
create trigger follows_notify_new_follower
  after insert on public.follows
  for each row execute function public.notify_new_follower();

-- avatars storage policies (after creating the public "avatars" bucket)
create policy "avatar_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_read_public" on storage.objects for select
  using (bucket_id = 'avatars');

-- notifications: a lightweight activity feed (level up, referral joined,
-- friend request) layered on top of existing systems - the friend-request
-- badge (fetchPendingRequestCount) keeps its current "requests needing
-- action" meaning unchanged; this table is purely additive, driving
-- toast popups and a recent-activity list, not a replacement for it.
-- Every row is written by a trigger or a security-definer function below,
-- never the client directly - same lockdown as point_events, which has no
-- insert policy for authenticated either.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('new_follower', 'referral_joined', 'level_up', 'creator_request_approved')),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at) where read_at is null;
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
revoke insert on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "notifications_update_own" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- last_notified_level: watermark for sync_level_up_notifications() below,
-- separate from the level itself (never stored - see src/lib/levels.ts)
-- so a level-up notification only ever fires once per level, not once per
-- sync call. No client grant, same reasoning as is_admin/referred_by -
-- only ever written by the security-definer function below.
alter table public.profiles add column last_notified_level integer not null default 0;

-- Cost to reach a given level, 1-50. Ten ranks of five sub-levels: a
-- rank's entry cost is a fixed rung, and its five sub-levels climb
-- geometrically from that rung toward the next rank's entry.
--
-- MUST stay in step with cumulativeForLevel() in src/lib/levels.ts. The
-- two are read in different places - the app draws the ladder, the
-- function below decides when a level_up notification fires - and if they
-- disagree, someone is congratulated for a level the page does not show.
-- See 0040_reprice_levels.sql for why GOAT is 500,000 rather than the
-- 162,150 the original triangular curve produced.
create or replace function public.points_for_level(lvl integer)
returns integer
language plpgsql
immutable
as $$
declare
  -- Entry cost per rank, in RANKS order. Practice Squad is non-zero so
  -- that a player with no points is unranked rather than level 1.
  entry constant integer[] := array[100, 500, 2000, 6000, 15000, 32500, 65000, 125000, 250000, 500000];
  max_points constant integer := 1000000; -- GOAT V
  rank_i integer;
  step_i integer;
  from_p integer;
  to_p integer;
  span integer;
begin
  if lvl <= 0 then
    return 0;
  end if;
  rank_i := least((lvl - 1) / 5, 9) + 1; -- Postgres arrays are 1-based
  step_i := (lvl - 1) % 5;
  from_p := entry[rank_i];

  if step_i = 0 then
    return from_p;
  end if;

  if rank_i = 10 then
    -- The last rank has no next rank to run toward, so it lands ON the
    -- ceiling rather than approaching it: GOAT V is exactly max_points.
    to_p := max_points;
    span := 4;
  else
    to_p := entry[rank_i + 1];
    span := 5;
  end if;

  return round(from_p * power(to_p::numeric / from_p::numeric, step_i::numeric / span::numeric));
end;
$$;

-- SQL port of getLevelInfo()'s loop in src/lib/levels.ts - deliberately a
-- loop, not a closed-form inversion of the curve, so floating-point
-- rounding can't land a player on the wrong side of a threshold.
create or replace function public.level_for_points(total_points integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl integer := 0;
begin
  while lvl < 50 and total_points >= public.points_for_level(lvl + 1) loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end;
$$;

-- Idempotent and race-safe: the `for update` lock means two concurrent
-- calls for the same user can't both read the same stale
-- last_notified_level and both insert a duplicate level_up notification -
-- the second caller blocks, then re-reads the first caller's write once
-- unblocked. One notification per call even if multiple levels were
-- crossed at once ("Level 12" already implies you passed 11).
create or replace function public.sync_level_up_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_level integer;
  v_last integer;
begin
  select coalesce(sum(points), 0) into v_total from public.point_events where user_id = auth.uid();
  v_level := public.level_for_points(v_total);

  select last_notified_level into v_last from public.profiles where id = auth.uid() for update;

  if v_level > coalesce(v_last, 0) then
    insert into public.notifications (user_id, type, data)
    values (auth.uid(), 'level_up', jsonb_build_object('level', v_level));

    update public.profiles set last_notified_level = v_level where id = auth.uid();
  end if;
end;
$$;
grant execute on function public.sync_level_up_notifications() to authenticated;

-- Returns everyone the caller has referred - reads profiles directly
-- (not the leaderboard view, which filters to username is not null) so a
-- brand-new referee shows up here even before they've set a username.
-- Security definer, but safe: it only ever reads rows scoped to
-- auth.uid() as the referrer, same reasoning as every other sync
-- function above.
create or replace function public.fetch_my_referrals()
returns table (user_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, username, display_name, avatar_url, created_at
  from public.profiles
  where referred_by = auth.uid()
  order by created_at desc;
$$;
grant execute on function public.fetch_my_referrals() to authenticated;

-- The public profile page needs a couple of aggregate counts that
-- point_events and season_picks' own "select own" RLS policies don't
-- allow a stranger to read directly (point_events_select_own,
-- season_picks_select_own). These expose just the counts a profile
-- needs - never the underlying rows - same reasoning as
-- is_username_available and fetch_my_referrals above.
create or replace function public.public_referral_count(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.profiles where referred_by = p_user_id;
$$;
grant execute on function public.public_referral_count(uuid) to anon, authenticated;

-- Same shape as fetchPredictorProgress's own query (team -> distinct
-- weeks picked), just re-exposed for an arbitrary user_id instead of
-- auth.uid() - "which teams are fully done" is still computed
-- client-side against REQUIRED_PREDICTOR_WEEKS, same as the achievements
-- tab, rather than duplicating that threshold logic in SQL.
create or replace function public.public_predictor_progress(p_user_id uuid)
returns table (tracked_team text, weeks_picked integer)
language sql
security definer
set search_path = public
stable
as $$
  select tracked_team, count(distinct week)::integer as weeks_picked
  from public.season_picks
  where user_id = p_user_id
  group by tracked_team;
$$;
grant execute on function public.public_predictor_progress(uuid) to anon, authenticated;

-- Same reasoning as the two functions above: weekly_picks and
-- point_events are both locked to "select own" RLS, so the player
-- profile popup's weeks-completed and lock-bonus stats need
-- security-definer RPCs too.
create or replace function public.public_weekly_pickem_progress(p_user_id uuid)
returns table (week integer, games_picked integer)
language sql
security definer
set search_path = public
stable
as $$
  select week, count(distinct game_id)::integer as games_picked
  from public.weekly_picks
  where user_id = p_user_id
  group by week;
$$;
grant execute on function public.public_weekly_pickem_progress(uuid) to anon, authenticated;

create or replace function public.public_lock_bonus_count(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer from public.point_events where user_id = p_user_id and source = 'lock_correct';
$$;
grant execute on function public.public_lock_bonus_count(uuid) to anon, authenticated;

-- public_friend_count no longer needed: follows/friends are publicly
-- readable (see the follows table above), so a friend count is just a
-- plain filtered count against public.friends, no RPC required.
