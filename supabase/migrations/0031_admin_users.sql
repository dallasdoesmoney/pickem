-- Admin user directory + manual referral attribution.
--
-- Referrals are normally claimed by the referee themselves, once, via
-- claim_referral() using the referrer's username as the code. That only
-- works when someone actually follows the link. People get referred by
-- word of mouth all the time and arrive at the site directly, and there
-- was no way to credit that after the fact - profiles.referred_by has no
-- client update grant at all (deliberately: see the profiles table in
-- schema.sql, it exists so nobody can reassign their own referrer to farm
-- points for a friend). So the fix is another security-definer path, this
-- one gated on is_admin().

-- The directory. profiles is select-own only, so an admin can't read
-- other people's rows directly - this is the only way to enumerate them.
-- Joins in the things you need to identify a person and judge whether an
-- attribution is plausible: who referred them, how many they have
-- referred, when they joined, and their email (the only usable
-- identifier for an account that never picked a username).
--
-- Deliberately narrow: it selects only columns guaranteed by the original
-- schema.sql, never one added by a later migration. An admin tool that
-- fails to open because an unrelated optional migration was skipped is
-- worse than one that shows a field less.
-- Dropped first, not just replaced: create-or-replace cannot change a
-- function's OUT columns, and this one's return type has already changed
-- once (it used to select profiles.newsletter_subscribed, a column added
-- by a migration that was never run). Without the drop, editing the
-- returned shape again fails with 42P13 against any database that already
-- has an older copy.
drop function if exists public.admin_list_users(text, int, int);
create function public.admin_list_users(
  p_search text default '',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  email text,
  created_at timestamptz,
  is_admin boolean,
  referred_by uuid,
  referrer_username text,
  referrer_display_name text,
  referral_count int,
  total_points int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_search text := coalesce(btrim(p_search), '');
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    u.email::text,
    p.created_at,
    p.is_admin,
    p.referred_by,
    r.username,
    r.display_name,
    (select count(*) from public.profiles c where c.referred_by = p.id)::int,
    -- Same definition the leaderboard view uses, so the number here
    -- matches what the player sees.
    coalesce((select sum(pe.points) from public.point_events pe where pe.user_id = p.id), 0)::int
  from public.profiles p
  left join public.profiles r on r.id = p.referred_by
  left join auth.users u on u.id = p.id
  where
    v_search = ''
    or p.username ilike '%' || v_search || '%'
    or p.display_name ilike '%' || v_search || '%'
    or u.email ilike '%' || v_search || '%'
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
end;
$$;
grant execute on function public.admin_list_users(text, int, int) to authenticated;

-- Sets (or clears, with a null/blank username) who referred a user, and
-- moves the point ledger to match.
--
-- Unlike claim_referral this is NOT claim-once - an admin correcting an
-- attribution has to be able to change or remove one that is already
-- there. That makes reversing the old pairing the important part: the two
-- point_events rows are keyed by (user_id, source, reference_id), so the
-- pair belonging to the previous referrer is addressable exactly and gets
-- deleted before the new pair is written. Without that, re-pointing a
-- referral would leave the old referrer holding 1,000 points for a
-- referral that is no longer theirs.
--
-- 1000 is repeated from claim_referral rather than shared: these are two
-- independently tunable prices (a manual correction may not always want
-- to pay what an organic signup pays), and a bonus already awarded is
-- historical fact in the ledger regardless of what the constant says
-- later.
--
-- No 'referral_joined' notification, deliberately. That notification says
-- somebody joined using your link, which is not what happened here and
-- would be dated to today for a signup that may be months old. The points
-- and the referral count are the credit; the timeline stays honest.
drop function if exists public.admin_set_referrer(uuid, text);
create function public.admin_set_referrer(p_user_id uuid, p_referrer_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_referrer uuid;
  v_old_referrer uuid;
  v_exists boolean;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select true, referred_by into v_exists, v_old_referrer
  from public.profiles where id = p_user_id;
  if v_exists is not true then
    raise exception 'No such user';
  end if;

  if coalesce(btrim(p_referrer_username), '') = '' then
    v_new_referrer := null;
  else
    select id into v_new_referrer
    from public.profiles
    where lower(username) = lower(btrim(p_referrer_username));

    if v_new_referrer is null then
      raise exception 'No user with username %', btrim(p_referrer_username);
    end if;
    if v_new_referrer = p_user_id then
      raise exception 'A user cannot refer themselves';
    end if;
  end if;

  -- is not distinct from: both-null counts as unchanged.
  if v_old_referrer is not distinct from v_new_referrer then
    return;
  end if;

  if v_old_referrer is not null then
    delete from public.point_events
    where (user_id = v_old_referrer and source = 'referral' and reference_id = p_user_id::text)
       or (user_id = p_user_id and source = 'referral_signup' and reference_id = v_old_referrer::text);
  end if;

  update public.profiles set referred_by = v_new_referrer where id = p_user_id;

  if v_new_referrer is not null then
    insert into public.point_events (user_id, source, points, reference_id)
    values
      (v_new_referrer, 'referral', 1000, p_user_id::text),
      (p_user_id, 'referral_signup', 1000, v_new_referrer::text)
    on conflict (user_id, source, reference_id) do nothing;
  end if;
end;
$$;
grant execute on function public.admin_set_referrer(uuid, text) to authenticated;
