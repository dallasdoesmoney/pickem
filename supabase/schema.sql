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
grant update (display_name, avatar_url, username, migrated_local_picks) on public.profiles to authenticated;
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

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
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

-- user_badges: non-level badges (streak, YouTube member, etc.) - need real
-- state or manual granting, unlike the computed level badge. Public
-- select (same reasoning as the leaderboard view); writes are admin/SQL
-- Editor only for now, same bootstrapping as profiles.is_admin.
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

-- Awards the flat 100-point "filled out every game in a week" achievement
-- (src/data/achievements.ts), idempotently, for every week the caller has
-- fully picked. Same security-definer reasoning as
-- sync_predictor_achievements(). Required game counts per week are
-- hardcoded (src/data/games.ts can't be read from SQL) - keep this CASE
-- in sync with GAMES_BY_WEEK if the schedule data ever changes.
create or replace function public.sync_weekly_pickem_achievements()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.point_events (user_id, source, points, reference_id)
  select auth.uid(), 'weekly_pickem_complete', 100, wp.week::text
  from public.weekly_picks wp
  where wp.user_id = auth.uid()
  group by wp.week
  having count(distinct wp.game_id) >= case wp.week
    when 1 then 16 when 2 then 16 when 3 then 16 when 4 then 16
    when 5 then 15 when 6 then 14 when 7 then 14 when 8 then 14
    when 9 then 15 when 10 then 14 when 11 then 13 when 12 then 16
    when 13 then 14 when 14 then 15 when 15 then 16 when 16 then 16
    when 17 then 16 when 18 then 16
    else 999
  end
  on conflict (user_id, source, reference_id) do nothing;
end;
$$;
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

-- friends: symmetric, request/accept (not the asymmetric "follow"
-- planned for later). Unique index on the unordered pair stops A->B and
-- B->A pending requests from coexisting.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_unique_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);
alter table public.friendships enable row level security;
-- Column-level lockdown (same pattern as profiles.is_admin): the only
-- thing an update is ever allowed to touch is status.
revoke insert on public.friendships from authenticated;
revoke update on public.friendships from authenticated;
grant insert (requester_id, addressee_id) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;
create policy "friendships_select_own" on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_insert_own" on public.friendships for insert
  with check (auth.uid() = requester_id);
create policy "friendships_update_addressee_accept" on public.friendships for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (status = 'accepted');
create policy "friendships_delete_party" on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create trigger friendships_set_updated_at before update on public.friendships
  for each row execute function public.set_updated_at();

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
  type text not null check (type in ('friend_request', 'referral_joined', 'level_up', 'friend_accepted')),
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

-- Fires whenever a friend request is sent (friendships always inserts as
-- 'pending' - the client can't supply any other status, see the
-- column-level grant on friendships) so the addressee gets a toast
-- without sendFriendRequest() needing to know about notifications at all.
create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, data)
    values (new.addressee_id, 'friend_request', jsonb_build_object('requester_id', new.requester_id, 'friendship_id', new.id));
  end if;
  return new;
end;
$$;
create trigger friendships_notify_request
  after insert on public.friendships
  for each row execute function public.notify_friend_request();

-- Fires on the pending->accepted transition specifically and notifies the
-- requester, not the accepter - the accepter already sees the result of
-- their own action immediately in FriendButton's state.
create or replace function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, type, data)
    values (new.requester_id, 'friend_accepted', jsonb_build_object('accepter_id', new.addressee_id, 'friendship_id', new.id));
  end if;
  return new;
end;
$$;
create trigger friendships_notify_accepted
  after update on public.friendships
  for each row execute function public.notify_friend_accepted();

-- last_notified_level: watermark for sync_level_up_notifications() below,
-- separate from the level itself (never stored - see src/lib/levels.ts)
-- so a level-up notification only ever fires once per level, not once per
-- sync call. No client grant, same reasoning as is_admin/referred_by -
-- only ever written by the security-definer function below.
alter table public.profiles add column last_notified_level integer not null default 0;

-- SQL port of getLevelInfo()'s loop in src/lib/levels.ts - deliberately a
-- loop, not a closed-form inversion of the triangular-number curve, so
-- floating-point rounding can't land it on the wrong side of a threshold.
-- Keep in sync with BASE_POINTS/MAX_LEVEL there if the curve ever changes.
create or replace function public.level_for_points(total_points integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl integer := 0;
begin
  while lvl < 50 and total_points >= 75 * (lvl + 1) * (lvl + 2) loop
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
