-- Social/streaming links a Creator can add to their public profile.
-- Insert is gated on actually holding the 'creator' badge (checked via
-- user_badges, not a separate role/permission system) - update/delete
-- of your own existing rows doesn't re-check, since there's no "revoke
-- creator" flow yet for that distinction to matter.

create table public.creator_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('twitch', 'youtube', 'twitter', 'instagram', 'tiktok', 'kick', 'website')),
  url text not null,
  created_at timestamptz not null default now(),
  unique (user_id, platform)
);
alter table public.creator_links enable row level security;

create policy "creator_links_select_all" on public.creator_links for select using (true);
grant select on public.creator_links to anon, authenticated;

revoke insert, update, delete on public.creator_links from authenticated;
grant insert (user_id, platform, url) on public.creator_links to authenticated;
grant update (url) on public.creator_links to authenticated;
grant delete on public.creator_links to authenticated;

create policy "creator_links_insert_own_creator" on public.creator_links for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.user_badges where user_id = auth.uid() and badge_key = 'creator')
  );
create policy "creator_links_update_own" on public.creator_links for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "creator_links_delete_own" on public.creator_links for delete
  using (auth.uid() = user_id);
