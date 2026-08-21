-- Editing and removing an account from the admin directory.
--
-- Same reasoning as 0031: profiles is select-own under RLS and its
-- identifying columns have narrow client grants, so an admin cannot
-- reach another person's row directly. Every door is a security-definer
-- function gated on is_admin(), and each one raises rather than
-- no-opping - these are deliberate acts with a person watching, not
-- background calls.

-- Rename an account. Both fields are optional: pass null to leave one
-- alone, so "just fix the display name" doesn't require re-sending a
-- username that is already right.
create or replace function public.admin_update_user(
  p_user_id uuid,
  p_username text default null,
  p_display_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text := nullif(trim(coalesce(p_username, '')), '');
  v_display  text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if v_username is not null then
    -- The same shape the signup path enforces (0003), restated here
    -- because this door bypasses that one entirely.
    if v_username !~ '^[a-zA-Z0-9_]{3,20}$' then
      raise exception 'Username must be 3-20 letters, numbers or underscores';
    end if;
    -- Case-insensitively unique, and not a clash with somebody else.
    if exists (
      select 1 from public.profiles
      where lower(username) = lower(v_username) and id <> p_user_id
    ) then
      raise exception 'That username is taken';
    end if;
    update public.profiles set username = v_username where id = p_user_id;
  end if;

  if v_display is not null then
    update public.profiles set display_name = left(v_display, 40) where id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_update_user(uuid, text, text) from public;
grant execute on function public.admin_update_user(uuid, text, text) to authenticated;

-- Grant or remove admin.
--
-- Refuses to remove the last one. Locking every admin out of the admin
-- panel is not recoverable from inside the app - it takes someone with
-- SQL access - and the mistake is one misplaced click away.
create or replace function public.admin_set_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  if p_is_admin = false
     and (select count(*) from public.profiles where is_admin) <= 1
     and exists (select 1 from public.profiles where id = p_user_id and is_admin) then
    raise exception 'That is the only admin left';
  end if;

  update public.profiles set is_admin = coalesce(p_is_admin, false) where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_admin(uuid, boolean) from public;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;

-- Delete an account, and everything it owns.
--
-- Deleting the auth.users row is what actually removes the account -
-- deleting only the profile would leave someone able to sign in to a
-- half-existing account. Everything downstream (profiles, picks, tier
-- lists, point events, follows, notifications) hangs off auth.users with
-- ON DELETE CASCADE, so this one delete takes the lot.
--
-- Two guards, both because this is irreversible:
--   - never yourself, which is the click nobody means to make;
--   - never another admin, so removing one is a deliberate two-step
--     (drop their admin flag first, then delete).
create or replace function public.admin_delete_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own account here';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and is_admin) then
    raise exception 'Remove their admin access first';
  end if;

  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

-- The email to send a reset to.
--
-- admin_list_users already returns it, but this is the one value the
-- client needs at the moment of acting rather than at list time, and
-- fetching it fresh means a reset can never be sent to an address the
-- open page has gone stale on.
create or replace function public.admin_user_email(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;
  return (select email from auth.users where id = p_user_id);
end;
$$;

revoke all on function public.admin_user_email(uuid) from public;
grant execute on function public.admin_user_email(uuid) to authenticated;
