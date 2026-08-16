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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Column-level lockdown: RLS policies below are row-level only (auth.uid()
-- = id), which would otherwise let anyone grant themselves admin via
-- `update profiles set is_admin = true` on their own row. is_admin can
-- only ever be set from the SQL Editor.
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week, game_id)
);
create index weekly_picks_user_week_idx on public.weekly_picks (user_id, week);
alter table public.weekly_picks enable row level security;
create policy "weekly_picks_select_own" on public.weekly_picks for select using (auth.uid() = user_id);
create policy "weekly_picks_insert_own" on public.weekly_picks for insert with check (auth.uid() = user_id);
create policy "weekly_picks_update_own" on public.weekly_picks for update using (auth.uid() = user_id);
create policy "weekly_picks_delete_own" on public.weekly_picks for delete using (auth.uid() = user_id);
create trigger weekly_picks_set_updated_at
  before update on public.weekly_picks for each row execute function public.set_updated_at();

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

-- avatars storage policies (after creating the public "avatars" bucket)
create policy "avatar_upload_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar_read_public" on storage.objects for select
  using (bucket_id = 'avatars');
