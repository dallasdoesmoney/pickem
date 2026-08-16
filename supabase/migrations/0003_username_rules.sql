-- Safe to run whether or not you already ran 0002_add_username.sql -
-- every statement here is idempotent (IF EXISTS / IF NOT EXISTS / OR
-- REPLACE), so this is now the one script to run. Bumps the minimum
-- length to 4 and adds a server-side profanity backstop matching
-- src/lib/usernamePolicy.ts's client-side list, so the rule holds even
-- if someone bypasses the client check and calls the API directly.

alter table public.profiles add column if not exists username text;

alter table public.profiles drop constraint if exists profiles_username_format;
alter table public.profiles add constraint profiles_username_format
  check (
    username is null or (
      username ~ '^[a-zA-Z0-9_]{4,20}$'
      and username !~* '(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard|whore|slut|rape|nazi|hitler|pussy)'
    )
  );

create unique index if not exists profiles_username_lower_idx on public.profiles (lower(username));

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
