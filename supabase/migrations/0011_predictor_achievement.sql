-- Awards the flat 50-point "completed a team's full season predictor"
-- achievement (src/data/achievements.ts), idempotently, for every team
-- the caller has fully filled in. Security definer so it can read the
-- caller's own season_picks in bulk and insert into point_events (which
-- has no insert policy for authenticated - see schema.sql) without
-- broadening either table's RLS; it only ever acts on auth.uid(), never a
-- caller-supplied user id.
--
-- Required weeks is hardcoded to 17 (an 18-week season minus the one bye
-- every team gets) rather than read from src/data/games.ts, which this
-- function can't see - keep this in sync if the real schedule ever gives
-- a team more than one bye week.
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
