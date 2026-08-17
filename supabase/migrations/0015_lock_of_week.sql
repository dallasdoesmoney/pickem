-- One lock per user per week, on one of that week's own picks - reuses
-- weekly_picks (a lock is just a flag on an existing pick) rather than a
-- new table. The partial unique index is what actually enforces "at most
-- one," not application code.
alter table public.weekly_picks add column is_lock boolean not null default false;
create unique index weekly_picks_one_lock_per_week on public.weekly_picks (user_id, week) where is_lock;

-- Awards a bonus for each lock that hit, once results are published.
-- Distinct from sync_weekly_pickem_achievements (that one rewards
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
