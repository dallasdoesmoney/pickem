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
