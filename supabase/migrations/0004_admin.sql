-- Adds admin capability: exactly one account (you) can toggle which
-- weeks are open for picking and record game results. Idempotent-safe
-- to run regardless of what's already in place.

alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Privilege-escalation guard: profiles_update_own's RLS policy is
-- row-level only (auth.uid() = id), so without this, anyone could grant
-- themselves admin via `update profiles set is_admin = true`. Column-level
-- grants are a separate, earlier gate that RLS can't express on its own -
-- the normal app API can update your own display fields, but never
-- is_admin, regardless of what the row-level policy allows. is_admin can
-- only ever be set from the SQL Editor (see the UPDATE at the bottom).
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name, avatar_url, username, migrated_local_picks) on public.profiles to authenticated;

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
-- the "results are in" email).
create table if not exists public.weeks (
  week integer primary key,
  is_open boolean not null default false,
  results_published boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into public.weeks (week)
  select generate_series(1, 18)
  on conflict (week) do nothing;

alter table public.weeks enable row level security;
drop policy if exists "weeks_select_all" on public.weeks;
drop policy if exists "weeks_insert_admin" on public.weeks;
drop policy if exists "weeks_update_admin" on public.weeks;
drop policy if exists "weeks_delete_admin" on public.weeks;
create policy "weeks_select_all" on public.weeks for select using (true);
create policy "weeks_insert_admin" on public.weeks for insert with check (public.is_admin());
create policy "weeks_update_admin" on public.weeks for update using (public.is_admin());
create policy "weeks_delete_admin" on public.weeks for delete using (public.is_admin());

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists weeks_set_updated_at on public.weeks;
create trigger weeks_set_updated_at before update on public.weeks
  for each row execute function public.set_updated_at();

-- game_results: one row per game (game_id matches Game.id from
-- src/data/games.ts), the winning team's abbreviation.
create table if not exists public.game_results (
  game_id text primary key,
  week integer not null,
  winner text not null,
  updated_at timestamptz not null default now()
);
create index if not exists game_results_week_idx on public.game_results (week);

alter table public.game_results enable row level security;
drop policy if exists "game_results_select_all" on public.game_results;
drop policy if exists "game_results_insert_admin" on public.game_results;
drop policy if exists "game_results_update_admin" on public.game_results;
drop policy if exists "game_results_delete_admin" on public.game_results;
create policy "game_results_select_all" on public.game_results for select using (true);
create policy "game_results_insert_admin" on public.game_results for insert with check (public.is_admin());
create policy "game_results_update_admin" on public.game_results for update using (public.is_admin());
create policy "game_results_delete_admin" on public.game_results for delete using (public.is_admin());

drop trigger if exists game_results_set_updated_at on public.game_results;
create trigger game_results_set_updated_at before update on public.game_results
  for each row execute function public.set_updated_at();

-- Run this once, with your real email, to make your account the admin.
-- Nobody else can do this to themselves - it's only possible from here.
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'dallas.wsteven@gmail.com');
