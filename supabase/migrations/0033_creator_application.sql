-- Turns the creator request from "one URL and a note" into a real
-- application, and makes an approval carry the applicant's channels onto
-- their profile automatically.
--
-- The channels are the reason this needs a migration rather than just a
-- bigger form. creator_links only accepts inserts from accounts that
-- already hold the Creator badge (creator_links_insert_own_creator in
-- schema.sql), which is correct - it stops anyone decorating their
-- profile with channel links they haven't earned. So an applicant cannot
-- write there, and the answers live on the request row until the moment
-- an admin approves, at which point review_creator_request copies them
-- across. That is what makes "you never re-enter your links" true.

alter table public.creator_requests
  -- [{ "platform": "youtube", "url": "https://..." }, ...]. Deliberately
  -- jsonb rather than its own table: this is a snapshot of what someone
  -- claimed at application time, not live data, and it should stay
  -- exactly as submitted even after the real creator_links rows are
  -- edited later.
  add column if not exists socials jsonb not null default '[]'::jsonb,
  add column if not exists audience_size text,
  add column if not exists primary_platform text,
  add column if not exists content_types text[] not null default '{}',
  add column if not exists cadence text,
  add column if not exists nfl_focus text,
  add column if not exists contact_handle text;

-- content_url is now "best example of your work" and genuinely optional:
-- someone who lists three channels has already shown their work, and a
-- required field they have nothing to put in only teaches people to
-- paste junk.
alter table public.creator_requests alter column content_url drop not null;

grant insert (
  user_id, content_url, note, socials, audience_size,
  primary_platform, content_types, cadence, nfl_focus, contact_handle
) on public.creator_requests to authenticated;

-- Approval now also publishes the channels. Everything else about this
-- function is unchanged from 0025.
create or replace function public.review_creator_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_socials jsonb;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select user_id, socials into v_user_id, v_socials
  from public.creator_requests where id = p_request_id and status = 'pending';
  if v_user_id is null then
    return;
  end if;

  update public.creator_requests
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  if p_approve then
    insert into public.user_badges (user_id, badge_key) values (v_user_id, 'creator')
    on conflict (user_id, badge_key) do nothing;

    -- Publish whatever they gave us. on conflict do nothing rather than
    -- overwriting: a re-application must never clobber a link the
    -- creator has since edited by hand. The platform filter guards the
    -- check constraint on creator_links - a junk platform string in the
    -- snapshot would otherwise abort the whole approval.
    insert into public.creator_links (user_id, platform, url)
    select v_user_id, item ->> 'platform', item ->> 'url'
    from jsonb_array_elements(coalesce(v_socials, '[]'::jsonb)) as item
    where coalesce(item ->> 'url', '') <> ''
      and item ->> 'platform' in ('twitch', 'youtube', 'twitter', 'instagram', 'tiktok', 'kick', 'website')
    on conflict (user_id, platform) do nothing;

    insert into public.notifications (user_id, type, data)
    values (v_user_id, 'creator_request_approved', '{}'::jsonb);
  end if;
end;
$$;
grant execute on function public.review_creator_request(uuid, boolean) to authenticated;
