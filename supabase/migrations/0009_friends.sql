-- Friends: symmetric, request/accept (not the asymmetric "follow"
-- discussed for later). One row per relationship regardless of
-- direction - a unique index on the unordered pair (least/greatest)
-- stops both A->B and B->A pending requests from coexisting, which a
-- plain unique(requester_id, addressee_id) wouldn't catch.
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index friendships_unique_pair_idx on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);
create index friendships_requester_idx on public.friendships (requester_id, status);

alter table public.friendships enable row level security;

-- Column-level lockdown, same pattern as profiles.is_admin: RLS alone
-- can't stop an update payload from also smuggling in a different
-- requester_id/addressee_id in the same call, so the only column an
-- update is ever allowed to touch is status.
revoke insert on public.friendships from authenticated;
revoke update on public.friendships from authenticated;
grant insert (requester_id, addressee_id) on public.friendships to authenticated;
grant update (status) on public.friendships to authenticated;

create policy "friendships_select_own" on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "friendships_insert_own" on public.friendships for insert
  with check (auth.uid() = requester_id);
-- Only the addressee can act on a pending request, and only by moving it
-- to accepted - declining/canceling/unfriending are all a DELETE instead
-- (see below), not a status change, so there's no "declined" state to
-- misuse for re-requesting.
create policy "friendships_update_addressee_accept" on public.friendships for update
  using (auth.uid() = addressee_id and status = 'pending')
  with check (status = 'accepted');
-- Either party can delete: the requester canceling their own pending
-- request, the addressee declining one, or either side unfriending an
-- accepted one - all the same operation from the DB's point of view.
create policy "friendships_delete_party" on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create trigger friendships_set_updated_at before update on public.friendships
  for each row execute function public.set_updated_at();
