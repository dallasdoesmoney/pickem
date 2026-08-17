-- Same reasoning as 0018_public_profile_stats.sql: weekly_picks and
-- point_events are both locked to "select own" RLS, so the player
-- profile popup (now showing weeks-completed and lock-bonus counts too,
-- not just referrals/teams predicted) needs security-definer RPCs for
-- these on an arbitrary user_id.

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
