-- Awards the flat 100-point "filled out every game in a week" achievement
-- (src/data/achievements.ts), idempotently, for every week the caller has
-- fully picked. Security definer so it can read the caller's own
-- weekly_picks in bulk and insert into point_events without broadening
-- either table's RLS; it only ever acts on auth.uid(), never a
-- caller-supplied user id.
--
-- Required game counts per week are hardcoded (src/data/games.ts can't be
-- read from SQL) - keep this CASE in sync with GAMES_BY_WEEK if the
-- schedule data ever changes.
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
