-- notifications: a lightweight activity feed (level up, referral joined,
-- friend request) layered on top of existing systems - the friend-request
-- badge (fetchPendingRequestCount) keeps its current "requests needing
-- action" meaning unchanged; this table is purely additive, driving
-- toast popups and a recent-activity list, not a replacement for it.
-- Every row is written by a trigger or a security-definer function below,
-- never the client directly - same lockdown as point_events, which has no
-- insert policy for authenticated either.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('friend_request', 'referral_joined', 'level_up')),
  data jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on public.notifications (user_id, created_at) where read_at is null;
alter table public.notifications enable row level security;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
revoke insert on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;
create policy "notifications_update_own" on public.notifications for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Fires whenever a friend request is sent (friendships always inserts as
-- 'pending' - the client can't supply any other status, see the
-- column-level grant on friendships) so the addressee gets a toast
-- without sendFriendRequest() needing to know about notifications at all.
create or replace function public.notify_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, data)
    values (new.addressee_id, 'friend_request', jsonb_build_object('requester_id', new.requester_id, 'friendship_id', new.id));
  end if;
  return new;
end;
$$;
create trigger friendships_notify_request
  after insert on public.friendships
  for each row execute function public.notify_friend_request();

-- last_notified_level: watermark for sync_level_up_notifications() below,
-- separate from the level itself (never stored - see src/lib/levels.ts)
-- so a level-up notification only ever fires once per level, not once per
-- sync call. No client grant, same reasoning as is_admin/referred_by -
-- only ever written by the security-definer function below.
alter table public.profiles add column last_notified_level integer not null default 0;

-- SQL port of getLevelInfo()'s loop in src/lib/levels.ts - deliberately a
-- loop, not a closed-form inversion of the triangular-number curve, so
-- floating-point rounding can't land it on the wrong side of a threshold.
-- Keep in sync with BASE_POINTS/MAX_LEVEL there if the curve ever changes.
create or replace function public.level_for_points(total_points integer)
returns integer
language plpgsql
immutable
as $$
declare
  lvl integer := 0;
begin
  while lvl < 50 and total_points >= 75 * (lvl + 1) * (lvl + 2) loop
    lvl := lvl + 1;
  end loop;
  return lvl;
end;
$$;

-- Idempotent and race-safe: the `for update` lock means two concurrent
-- calls for the same user can't both read the same stale
-- last_notified_level and both insert a duplicate level_up notification -
-- the second caller blocks, then re-reads the first caller's write once
-- unblocked. One notification per call even if multiple levels were
-- crossed at once ("Level 12" already implies you passed 11).
create or replace function public.sync_level_up_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_level integer;
  v_last integer;
begin
  select coalesce(sum(points), 0) into v_total from public.point_events where user_id = auth.uid();
  v_level := public.level_for_points(v_total);

  select last_notified_level into v_last from public.profiles where id = auth.uid() for update;

  if v_level > coalesce(v_last, 0) then
    insert into public.notifications (user_id, type, data)
    values (auth.uid(), 'level_up', jsonb_build_object('level', v_level));

    update public.profiles set last_notified_level = v_level where id = auth.uid();
  end if;
end;
$$;
grant execute on function public.sync_level_up_notifications() to authenticated;

-- Returns everyone the caller has referred - reads profiles directly
-- (not the leaderboard view, which filters to username is not null) so a
-- brand-new referee shows up here even before they've set a username.
-- Security definer, but safe: it only ever reads rows scoped to
-- auth.uid() as the referrer, same reasoning as every other sync
-- function above.
create or replace function public.fetch_my_referrals()
returns table (user_id uuid, username text, display_name text, avatar_url text, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select id, username, display_name, avatar_url, created_at
  from public.profiles
  where referred_by = auth.uid()
  order by created_at desc;
$$;
grant execute on function public.fetch_my_referrals() to authenticated;

-- Extend claim_referral() to also notify the referrer that someone joined
-- using their link. data is kept minimal (just the id) since the
-- referee's profile is likely still empty at this instant (username is
-- set later, not during signup) - display info gets resolved live via
-- fetch_my_referrals() when the notification is actually rendered,
-- rather than trusted from a stale snapshot taken here.
create or replace function public.claim_referral(p_referrer_username text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
begin
  if exists (select 1 from public.profiles where id = auth.uid() and referred_by is not null) then
    return;
  end if;

  select id into v_referrer_id from public.profiles where lower(username) = lower(p_referrer_username);
  if v_referrer_id is null or v_referrer_id = auth.uid() then
    return;
  end if;

  update public.profiles set referred_by = v_referrer_id where id = auth.uid();

  insert into public.point_events (user_id, source, points, reference_id)
  values
    (v_referrer_id, 'referral', 1000, auth.uid()::text),
    (auth.uid(), 'referral_signup', 1000, v_referrer_id::text)
  on conflict (user_id, source, reference_id) do nothing;

  insert into public.notifications (user_id, type, data)
  values (v_referrer_id, 'referral_joined', jsonb_build_object('referee_id', auth.uid()));
end;
$$;
grant execute on function public.claim_referral(text) to authenticated;
