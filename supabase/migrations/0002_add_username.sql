-- Run this in the Supabase SQL Editor. Adds a unique, case-insensitive
-- username to profiles (needed for leaderboards), plus a security-definer
-- function so availability can be checked without broadening the
-- profiles_select_own RLS policy to let people read each other's rows.

alter table public.profiles add column username text;
alter table public.profiles add constraint profiles_username_format
  check (username is null or username ~ '^[a-zA-Z0-9_]{3,20}$');
create unique index profiles_username_lower_idx on public.profiles (lower(username));

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
