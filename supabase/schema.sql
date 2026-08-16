-- Run this in the Supabase SQL Editor once, after Phase 0 setup
-- (project created, Google OAuth configured, email confirmation off,
-- "avatars" storage bucket created as public).

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  username text,
  migrated_local_picks boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');
create unique index profiles_username_lower_idx on public.profiles (lower(username));
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- Security-definer so username availability can be checked across all
-- users without broadening profiles_select_own to expose other rows.
create function public.is_username_available(check_username text)
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
