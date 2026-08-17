-- Adds the other half of the friend-request notification pair: today only
-- the addressee gets notified when a request comes in (friend_request);
-- nothing tells the requester when the other side accepts. This closes
-- that gap so the activity feed can show "X accepted your friend
-- request," not just "X sent you a friend request."
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('friend_request', 'referral_joined', 'level_up', 'friend_accepted'));

-- Fires on the pending->accepted transition specifically (not every
-- update - friendships only ever has status change today, but this
-- guards against that assumption breaking later) and notifies the
-- requester, not the accepter - the accepter already sees the result of
-- their own action immediately in FriendButton's state.
create or replace function public.notify_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (user_id, type, data)
    values (new.requester_id, 'friend_accepted', jsonb_build_object('accepter_id', new.addressee_id, 'friendship_id', new.id));
  end if;
  return new;
end;
$$;
create trigger friendships_notify_accepted
  after update on public.friendships
  for each row execute function public.notify_friend_accepted();
