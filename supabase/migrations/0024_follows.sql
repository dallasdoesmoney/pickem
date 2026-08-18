-- Replaces mutual-consent friendships (pending/accepted) with a
-- Twitter-style follow: anyone can follow anyone instantly, no approval
-- needed. "Friends" becomes a derived fact (the public.friends view
-- below) rather than its own stored state.
--
-- follows is deliberately PUBLIC READ (unlike friendships, which was
-- select-own and needed the public_friend_count security-definer RPC
-- just to show a count on someone else's profile) - follow graphs are
-- public info on Twitter-style platforms, and this app already exposes
-- the leaderboard/user_badges views the same way. Writes stay locked
-- down: insert only as yourself, delete only your own outgoing edge.

create table public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (follower_id <> followee_id)
);
create unique index follows_unique_edge_idx on public.follows (follower_id, followee_id);
create index follows_followee_idx on public.follows (followee_id, created_at);

alter table public.follows enable row level security;
create policy "follows_select_all" on public.follows for select using (true);
grant select on public.follows to anon, authenticated;
revoke insert on public.follows from authenticated;
grant insert (follower_id, followee_id) on public.follows to authenticated;
create policy "follows_insert_own" on public.follows for insert with check (auth.uid() = follower_id);
-- Each row belongs to exactly one person (the follower) - unfollowing
-- only ever removes your own edge, never the other side's. No update
-- policy at all: a follow has nothing mutable to change.
create policy "follows_delete_own" on public.follows for delete using (auth.uid() = follower_id);

-- Mutual pairs, both directions - plain view (not security-definer) is
-- safe here specifically because follows itself already grants
-- unrestricted select, so the view can't expose anything RLS wouldn't
-- already allow.
create view public.friends as
select a.follower_id as user_id, a.followee_id as friend_id, greatest(a.created_at, b.created_at) as became_friends_at
from public.follows a
join public.follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id;
grant select on public.friends to anon, authenticated;

-- Backfill BEFORE the notify trigger exists below, so migrating years of
-- history doesn't fire a notification storm. accepted -> both directions
-- become follows; pending -> one direction (the requester already
-- initiated contact).
insert into public.follows (follower_id, followee_id, created_at)
select requester_id, addressee_id, created_at from public.friendships where status = 'accepted'
union all
select addressee_id, requester_id, created_at from public.friendships where status = 'accepted'
union all
select requester_id, addressee_id, created_at from public.friendships where status = 'pending'
on conflict (follower_id, followee_id) do nothing;

drop table public.friendships;
drop function public.notify_friend_request();
drop function public.notify_friend_accepted();
drop function public.public_friend_count(uuid);

-- Old friend-related notification rows are transient toasts, not worth
-- keeping around with a now-invalid type - deleting them lets this
-- migration's final constraint match schema.sql's exactly, per the usual
-- dual-maintenance convention.
delete from public.notifications where type in ('friend_request', 'friend_accepted');
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_follower', 'referral_joined', 'level_up'));

-- Created LAST so it never fires during the backfill above. Notifies the
-- followee, and stamps is_mutual so the client can render "followed you
-- back - you're now friends!" without a second notification type or a
-- live re-resolution step against current follow state.
create or replace function public.notify_new_follower()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_mutual boolean;
begin
  v_is_mutual := exists (
    select 1 from public.follows
    where follower_id = new.followee_id and followee_id = new.follower_id
  );
  insert into public.notifications (user_id, type, data)
  values (new.followee_id, 'new_follower', jsonb_build_object('follower_id', new.follower_id, 'is_mutual', v_is_mutual));
  return new;
end;
$$;
create trigger follows_notify_new_follower
  after insert on public.follows
  for each row execute function public.notify_new_follower();
