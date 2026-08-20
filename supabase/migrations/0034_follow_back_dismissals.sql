-- "I saw it, and I'm not following back."
--
-- The follow-back list and the red badge beside the account menu are
-- both computed live: everyone who follows you, minus everyone you
-- follow. There is no third state, so a follower you have decided not to
-- follow back is indistinguishable from one you have not looked at yet.
-- The badge stays lit forever, and the only way to clear it is to follow
-- someone you did not want to follow.
--
-- This is that third state, and nothing more. A dismissal is not a
-- block: they still follow you, they still appear in your followers,
-- and nothing about it is visible to them. It only says "stop offering
-- me this one".
create table if not exists public.follow_back_dismissals (
  -- The person doing the dismissing - always the caller.
  user_id uuid not null references auth.users(id) on delete cascade,
  -- The follower being dismissed.
  follower_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Dismissing twice is not an error, it is the same dismissal.
  primary key (user_id, follower_id)
);

alter table public.follow_back_dismissals enable row level security;

-- Yours and only yours, in all three directions. Nobody can see who you
-- have dismissed, and nobody can dismiss on your behalf.
drop policy if exists follow_back_dismissals_select_own on public.follow_back_dismissals;
create policy follow_back_dismissals_select_own on public.follow_back_dismissals
  for select using (auth.uid() = user_id);

drop policy if exists follow_back_dismissals_insert_own on public.follow_back_dismissals;
create policy follow_back_dismissals_insert_own on public.follow_back_dismissals
  for insert with check (auth.uid() = user_id);

-- Deletable so the suggestion can come back - following them from their
-- profile and then unfollowing should not leave the row silently
-- suppressing them forever.
drop policy if exists follow_back_dismissals_delete_own on public.follow_back_dismissals;
create policy follow_back_dismissals_delete_own on public.follow_back_dismissals
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.follow_back_dismissals to authenticated;
