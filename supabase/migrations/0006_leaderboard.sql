-- Global leaderboard: aggregates weekly_picks against game_results, per
-- user, for weeks whose results have been published. A view (not a
-- broadened weekly_picks RLS policy) because weekly_picks_select_own must
-- stay exactly "own picks only" forever; this instead follows the same
-- shape as is_username_available: one narrow object, owned by the
-- migration-running role, that can read across all users for a single
-- pre-aggregated purpose and exposes nothing else - never a raw pick row.
--
-- Views run with the OWNER's privileges against their underlying tables
-- unless created `with (security_invoker = true)` (Postgres's default is
-- security_invoker = false). Since this view is owned by the same role
-- that owns weekly_picks (whoever runs this in the SQL Editor), and
-- table owners are exempt from their own table's RLS unless FORCE ROW
-- LEVEL SECURITY is set (it isn't, anywhere in this schema), the view's
-- query sees every user's weekly_picks rows - but only ever returns the
-- five aggregate columns below.
--
-- results_published is re-checked here rather than assumed: game_results
-- itself has no results_published condition on its own select policy
-- (game_results_select_all is unconditional `using (true)`), so raw
-- results are technically queryable early by anyone hitting the API
-- directly. This view is what actually enforces "hide until locked" for
-- the leaderboard, independent of that.
--
-- Idempotent: DROP + CREATE rather than CREATE OR REPLACE, so a rerun
-- after a column-list change doesn't error.
drop view if exists public.leaderboard;
create view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  count(*) filter (where wp.team_abbr = gr.winner)::int as correct,
  count(*)::int as graded
from public.weekly_picks wp
join public.weeks w on w.week = wp.week and w.results_published = true
join public.game_results gr on gr.game_id = wp.game_id
join public.profiles p on p.id = wp.user_id
where p.username is not null
group by p.id, p.username, p.avatar_url;

-- Belt-and-suspenders: Supabase's default privileges already grant select
-- on new tables/views in `public` to anon and authenticated (the same
-- reason no other table in this file has an explicit grant), but spelling
-- it out here documents intent the way is_username_available's grant does
-- for functions, whose default is the opposite (no PUBLIC execute).
grant select on public.leaderboard to anon, authenticated;
