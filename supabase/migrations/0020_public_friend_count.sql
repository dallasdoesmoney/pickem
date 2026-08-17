-- Same reasoning as 0018/0019: friendships is locked to "select own"
-- (requester or addressee), so the player profile popup needs a
-- security-definer RPC to show how many friends an arbitrary user_id
-- has.

create or replace function public.public_friend_count(p_user_id uuid)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.friendships
  where status = 'accepted'
    and (requester_id = p_user_id or addressee_id = p_user_id);
$$;
grant execute on function public.public_friend_count(uuid) to anon, authenticated;
