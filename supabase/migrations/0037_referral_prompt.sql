-- "Were you referred by anyone?", asked once, after signup.
--
-- A ?ref= link only attributes a signup if the person actually clicked
-- it, which most people don't - they hear about the site and type it in.
-- Those accounts have no referrer and never can, so the referral loop
-- quietly loses most of its reach. This is the other way in: ask them.

-- Same reasoning as onboarding_avatar_prompted and follow_recs_prompted -
-- a flag so the question is asked once and never nags again, whether
-- they answered it or skipped it.
alter table public.profiles
  add column if not exists onboarding_referral_prompted boolean not null default false;

grant update (onboarding_referral_prompted) on public.profiles to authenticated;

-- BOTH SIDES GET PAID NOW.
--
-- The original claim_referral paid the referrer 1000 and the new account
-- nothing, which was right when this only ever ran silently in the
-- background off a link. A dialog that says "you both get 1,000 points"
-- has to actually pay both, so the new account gets its own event.
--
-- It also has to answer. The old signature returned void and no-opped on
-- a bad username, a self-referral or a second attempt - fine for a
-- fire-and-forget background call with no UI waiting on it, useless to a
-- dialog that has to say whether it worked. This returns a text code the
-- client can act on, and the caller decides what to show.
--
-- Dropped rather than replaced: changing the return type of an existing
-- function is not something create-or-replace will do (42P13).
drop function if exists public.claim_referral(text);

create function public.claim_referral(p_referrer_username text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  -- Signed out there is nobody to credit, and the checks below all
  -- compare against a null uid, which passes them. Creating a function
  -- grants EXECUTE to PUBLIC unless you say otherwise, and the original
  -- never said otherwise - so this was reachable signed out.
  if auth.uid() is null then
    return 'not_signed_in';
  end if;

  -- Claimable exactly once per account. referred_by has no client update
  -- grant (see 0013), so this function is the only thing that can set it
  -- and nobody can reassign it later to farm points for a friend.
  if exists (select 1 from public.profiles where id = auth.uid() and referred_by is not null) then
    return 'already_claimed';
  end if;

  select id into v_referrer_id
  from public.profiles
  where lower(username) = lower(trim(p_referrer_username));

  if v_referrer_id is null then
    return 'no_such_user';
  end if;
  if v_referrer_id = auth.uid() then
    return 'self';
  end if;

  update public.profiles set referred_by = v_referrer_id where id = auth.uid();

  -- One insert per side, both keyed on the pair, so the unique index on
  -- (user_id, source, reference_id) makes a double-click a no-op rather
  -- than a double payout.
  insert into public.point_events (user_id, source, points, reference_id)
  values
    (v_referrer_id, 'referral', 1000, auth.uid()::text),
    (auth.uid(), 'referred_signup', 1000, v_referrer_id::text)
  on conflict (user_id, source, reference_id) do nothing;

  return 'ok';
end;
$$;

revoke all on function public.claim_referral(text) from public;
grant execute on function public.claim_referral(text) to authenticated;

-- Who you can name as your referrer, for the dialog's dropdown.
--
-- The leaderboard view already exposes exactly these columns to signed-in
-- clients, so this adds no new reach - what it adds is the SHAPE of the
-- query: a prefix search, capped, with the caller filtered out. Prefix
-- before substring, because someone typing "mike" means the account whose
-- name starts that way before one that merely contains it.
create or replace function public.search_referrers(p_query text, p_limit int default 6)
returns table (user_id uuid, username text, display_name text, avatar_url text, total_points int)
language sql
security definer
set search_path = public
stable
as $$
  with q as (
    select lower(trim(both from replace(coalesce(p_query, ''), '@', ''))) as term
  )
  select l.user_id, l.username, l.display_name, l.avatar_url, l.total_points
  from public.leaderboard l, q
  where q.term <> ''
    and l.user_id <> auth.uid()
    and (l.username ilike q.term || '%' or l.display_name ilike q.term || '%'
         or l.username ilike '%' || q.term || '%' or l.display_name ilike '%' || q.term || '%')
  order by
    (l.username ilike q.term || '%' or l.display_name ilike q.term || '%') desc,
    l.total_points desc,
    l.username asc
  limit least(greatest(coalesce(p_limit, 6), 1), 10);
$$;

revoke all on function public.search_referrers(text, int) from public;
grant execute on function public.search_referrers(text, int) to authenticated;
