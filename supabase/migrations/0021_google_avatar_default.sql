-- Google OAuth already puts a profile photo URL in
-- auth.users.raw_user_meta_data (under 'avatar_url' and/or 'picture' -
-- Supabase's Google provider sets both to the same value), but
-- handle_new_user() never copied it into public.profiles.avatar_url, so
-- new signups showed no photo until they manually uploaded one. This
-- just seeds it as a default - EditProfileModal's upload flow still
-- overwrites it freely any time after.

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  );
  return new;
end;
$$;

-- One-time backfill for everyone who already signed up before this
-- change. Scoped to avatar_url is null so it can never clobber a photo
-- someone already uploaded themselves - safe to run more than once.
update public.profiles p
set avatar_url = coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture')
from auth.users u
where p.id = u.id
  and p.avatar_url is null
  and coalesce(u.raw_user_meta_data->>'avatar_url', u.raw_user_meta_data->>'picture') is not null;
