-- Lets an account request a "Creator" badge (streamers/content makers),
-- reviewed by an admin. The first real writer into user_badges - that
-- table has existed since earlier but nothing ever populated it besides
-- the SQL Editor.

create table public.creator_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content_url text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
-- Only one live pending request per person at a time - resubmitting
-- after a rejection is fine (the previous row is 'rejected', not
-- 'pending'), but can't queue a second request while one's still
-- awaiting review.
create unique index creator_requests_one_pending_idx on public.creator_requests (user_id) where status = 'pending';
alter table public.creator_requests enable row level security;

create policy "creator_requests_select_own_or_admin" on public.creator_requests for select
  using (auth.uid() = user_id or public.is_admin());

revoke insert on public.creator_requests from authenticated;
grant insert (user_id, content_url, note) on public.creator_requests to authenticated;
create policy "creator_requests_insert_own" on public.creator_requests for insert
  with check (auth.uid() = user_id);
-- No update grant to authenticated at all - status only ever changes via
-- review_creator_request() below, so every approval/rejection is
-- funneled through one auditable, admin-checked path.

create or replace function public.review_creator_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select user_id into v_user_id from public.creator_requests where id = p_request_id and status = 'pending';
  if v_user_id is null then
    return;
  end if;

  update public.creator_requests
  set status = case when p_approve then 'approved' else 'rejected' end, reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  if p_approve then
    insert into public.user_badges (user_id, badge_key) values (v_user_id, 'creator') on conflict (user_id, badge_key) do nothing;
    insert into public.notifications (user_id, type, data) values (v_user_id, 'creator_request_approved', '{}'::jsonb);
  end if;
end;
$$;
grant execute on function public.review_creator_request(uuid, boolean) to authenticated;

alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type in ('new_follower', 'referral_joined', 'level_up', 'creator_request_approved'));
