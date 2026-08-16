-- point_events: append-only ledger of every point-earning action. Nothing
-- automatically awards points yet - no scoring rules are final (see
-- src/lib/levels.ts) - this is the generic sink so each future feature can
-- insert its own rows without another schema change. Totals are summed on
-- read (via the leaderboard view below), never stored, so the level curve
-- stays free to retune with zero migration.
create table public.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,        -- e.g. 'predictor_team_complete'
  points integer not null,
  reference_id text,           -- e.g. a team abbr - lets a source dedup itself
  created_at timestamptz not null default now(),
  unique (user_id, source, reference_id)
);
create index point_events_user_idx on public.point_events (user_id);
alter table public.point_events enable row level security;
create policy "point_events_select_own" on public.point_events for select using (auth.uid() = user_id);
-- No insert policy for authenticated - every point source ships as its own
-- reviewed feature (service role or a future security-definer function),
-- not a generic "add points" call any signed-in user could hit directly.

-- user_badges: non-level badges (streak, YouTube member, etc.) - these
-- need real state or manual granting rather than a formula, unlike the
-- level badge. Public select so badges render on the leaderboard/profile,
-- same reasoning as the leaderboard view itself; writes are admin/SQL
-- Editor only for now, same bootstrapping as profiles.is_admin, until an
-- admin UI or automated awarder exists.
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

-- leaderboard view gains total_points, summed from point_events and
-- left-joined so it stays 0 (not missing) for everyone until points exist.
drop view if exists public.leaderboard;
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
