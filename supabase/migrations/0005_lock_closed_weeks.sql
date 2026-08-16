-- Enforces week-open state at the database level, not just the UI - a
-- closed week can no longer be written to even by someone bypassing the
-- app's own buttons (e.g. calling the API directly). Idempotent.

drop policy if exists "weekly_picks_insert_own" on public.weekly_picks;
create policy "weekly_picks_insert_own" on public.weekly_picks for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.weeks w where w.week = weekly_picks.week and w.is_open = true)
  );

drop policy if exists "weekly_picks_update_own" on public.weekly_picks;
create policy "weekly_picks_update_own" on public.weekly_picks for update
  using (
    auth.uid() = user_id
    and exists (select 1 from public.weeks w where w.week = weekly_picks.week and w.is_open = true)
  );

drop policy if exists "weekly_picks_delete_own" on public.weekly_picks;
create policy "weekly_picks_delete_own" on public.weekly_picks for delete
  using (
    auth.uid() = user_id
    and exists (select 1 from public.weeks w where w.week = weekly_picks.week and w.is_open = true)
  );
