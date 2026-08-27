-- Email reminders: the weekly picks deadline.
--
-- WHY THERE IS NO SERVICE ROLE KEY HERE. The obvious way to email people
-- is a job holding the service role key, because that key can read
-- auth.users. It also bypasses RLS on every table in the database, so a
-- job whose whole purpose is "remind somebody to make their picks" would
-- be one leaked secret away from owning everything. This is the same
-- smaller door 0039 opened for game results: one token, checked inside
-- security-definer functions that each do exactly one thing, and good
-- for nothing else. The sender never gets a general-purpose key.
--
-- WHY OPT-IN AND NOT OPT-OUT. A deadline reminder is marketing mail, not
-- transactional - unlike the password reset Supabase already sends,
-- nobody asked for it by clicking something. So it defaults to OFF, it
-- carries an unsubscribe link that works without signing in, and turning
-- it off is one write that cannot fail. Getting this wrong does not
-- produce a bug report; it produces spam complaints, and a young sending
-- domain does not survive many.

-- ---------------------------------------------------------------- prefs
--
-- Its own table rather than columns on profiles, because profiles is
-- read by the leaderboard view and by anybody looking at a public
-- profile. An unsubscribe token is a bearer credential - anyone holding
-- it can turn somebody's email off - so it must not sit one careless
-- `select *` away from being public.
create table if not exists public.email_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- OFF until somebody asks for it. See above.
  weekly_deadline boolean not null default false,
  -- What the unsubscribe link carries. Random, per-user, and rotatable:
  -- if one ever leaks the worst case is that somebody else silences a
  -- reminder, and re-subscribing is a toggle in the account page.
  unsubscribe_token uuid not null default gen_random_uuid(),
  updated_at timestamptz not null default now()
);
alter table public.email_prefs enable row level security;

-- You can read and change your own preference and nobody else's. The
-- token is readable by its owner, which is harmless - it is their own
-- unsubscribe link - and by nobody else.
--
-- Dropped first, the way 0005 and 0034 do it: `create policy` has no
-- IF NOT EXISTS, and this file gets pasted into a SQL editor by hand.
-- Without these a second run dies partway through, leaving the tables up
-- and the functions absent - the worst possible half-state to debug.
drop policy if exists "email_prefs_select_own" on public.email_prefs;
drop policy if exists "email_prefs_insert_own" on public.email_prefs;
drop policy if exists "email_prefs_update_own" on public.email_prefs;
create policy "email_prefs_select_own" on public.email_prefs
  for select using (auth.uid() = user_id);
create policy "email_prefs_insert_own" on public.email_prefs
  for insert with check (auth.uid() = user_id);
create policy "email_prefs_update_own" on public.email_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Explicit grants, the way every other table here does it rather than
-- leaning on whatever the role happens to hold by default. A policy only
-- narrows an existing privilege - it never confers one - so without
-- these the toggle in the account page fails with "permission denied"
-- however correct the policies above look.
grant select on table public.email_prefs to authenticated;
grant insert (user_id) on table public.email_prefs to authenticated;

-- Column-level UPDATE, so a client cannot rewrite its own token to a
-- value it picked - which would let one account claim another's
-- unsubscribe link if the token were ever guessable. The revoke first is
-- what makes the narrow grant meaningful.
revoke update on table public.email_prefs from anon, authenticated;
grant update (weekly_deadline, updated_at) on table public.email_prefs to authenticated;

-- anon reaches this table through email_unsubscribe() and no other way.
revoke select, insert, delete on table public.email_prefs from anon;

drop trigger if exists email_prefs_set_updated_at on public.email_prefs;
create trigger email_prefs_set_updated_at
  before update on public.email_prefs for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- ledger
--
-- Every send, recorded once. The unique constraint is the whole point:
-- the job is scheduled hourly through a game day and most runs must send
-- nothing, so "have we already told this person about week 3" has to be
-- a database question rather than something the script remembers.
--
-- Same shape as point_events, and for the same reason - it is the
-- pattern this codebase already uses for "do this at most once".
create table if not exists public.email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  reference_id text not null,
  -- Resend's own id for the message. Useless on its own; the reason it
  -- is here from the start is that it is the ONLY join back to delivery
  -- and engagement events, and it cannot be recovered after the fact -
  -- a send recorded without one can never be tied to its bounce.
  provider_message_id text,
  -- How far through their card they were when we wrote to them. Stored
  -- rather than derived, because it is the only version of that number
  -- that can never be recovered later - by the time anybody asks whether
  -- the reminder worked, the picks have moved.
  picks_at_send integer,
  sent_at timestamptz not null default now(),
  unique (user_id, kind, reference_id)
);
-- RLS on with NO policies: nobody reaches this except the security
-- definer functions below. Not anon, not authenticated, not an admin.
alter table public.email_sends enable row level security;
revoke all on table public.email_sends from anon, authenticated;

-- --------------------------------------------------------------- sending
--
-- Who still needs telling about this week.
--
-- Returns an address, so read the guard carefully: a bad token gets an
-- exception, not an empty set. The week and the game count come from the
-- caller because the schedule lives in src/data/games.ts, not in the
-- database - weeks only carries is_open.
create or replace function public.weekly_deadline_recipients(
  p_token text,
  p_week integer,
  p_total_games integer
)
returns table (user_id uuid, email text, display_name text, made integer, unsub_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  select token into v_expected from public.sync_secrets where name = 'email_sender';
  -- No token configured means the door is shut, not open.
  if v_expected is null or coalesce(p_token, '') = '' or p_token <> v_expected then
    raise exception 'Not authorized';
  end if;
  if p_week is null or p_total_games is null or p_total_games <= 0 then
    raise exception 'Need a week and a positive game count';
  end if;
  if not exists (select 1 from public.weeks w where w.week = p_week and w.is_open) then
    raise exception 'Week % is not open', p_week;
  end if;

  return query
  select p.id,
         u.email::text,
         coalesce(nullif(p.display_name, ''), p.username, 'there'),
         coalesce(pk.n, 0)::integer,
         e.unsubscribe_token
    from public.profiles p
    join public.email_prefs e on e.user_id = p.id and e.weekly_deadline
    join auth.users u on u.id = p.id
    left join (
      select wp.user_id, count(*) as n
        from public.weekly_picks wp
       where wp.week = p_week
       group by wp.user_id
    ) pk on pk.user_id = p.id
   where u.email is not null
     -- A confirmed address only. Mailing an unconfirmed signup is how
     -- you deliver to somebody who never asked and never verified.
     and u.email_confirmed_at is not null
     and coalesce(pk.n, 0) < p_total_games
     and not exists (
       select 1 from public.email_sends s
        where s.user_id = p.id and s.kind = 'weekly_deadline'
          and s.reference_id = p_week::text
     );
end;
$$;

revoke all on function public.weekly_deadline_recipients(text, integer, integer) from public, anon, authenticated;

-- Record what went out. Called after Resend accepts, never before: a
-- crash between the two costs a missing row and a possible second email,
-- which is the right way round - recording first would silently drop the
-- reminder somebody was owed.
-- The uuid[] form this replaced is dropped explicitly: changing a
-- function's argument types creates an overload rather than replacing
-- it, so both would stay callable and which one ran would depend on how
-- the caller happened to type its arguments.
drop function if exists public.mark_emails_sent(text, text, text, uuid[]);

-- Takes [{user_id, message_id}] rather than a bare array of ids, so the
-- provider's message id is recorded in the same statement as the send.
-- Two calls would mean a window where a send exists with no id, which is
-- exactly the row you would later want to chase a bounce for.
create or replace function public.mark_emails_sent(
  p_token text,
  p_kind text,
  p_reference_id text,
  p_rows jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
  v_n integer;
begin
  select token into v_expected from public.sync_secrets where name = 'email_sender';
  if v_expected is null or coalesce(p_token, '') = '' or p_token <> v_expected then
    raise exception 'Not authorized';
  end if;

  insert into public.email_sends (user_id, kind, reference_id, provider_message_id, picks_at_send)
  select (r ->> 'user_id')::uuid, p_kind, p_reference_id,
         nullif(r ->> 'message_id', ''), (r ->> 'picks_at_send')::integer
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  on conflict (user_id, kind, reference_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.mark_emails_sent(text, text, text, jsonb) from public, anon, authenticated;

-- ----------------------------------------------------------- unsubscribe
--
-- Granted to ANON, deliberately. The person clicking this is reading
-- their email, not signed in to the site, and very likely on a different
-- device - so anything that puts a login in the way is a broken
-- unsubscribe, which is both a legal problem and the thing that turns an
-- annoyed reader into a spam complaint.
--
-- The token is the whole credential. That is the accepted trade for
-- unsubscribe links: worst case somebody who guessed a uuid turns off an
-- email, and the owner turns it back on with a toggle.
create or replace function public.email_unsubscribe(p_token uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hit integer;
begin
  update public.email_prefs
     set weekly_deadline = false, updated_at = now()
   where unsubscribe_token = p_token;
  get diagnostics v_hit = row_count;
  -- True for "you are unsubscribed", including when you already were.
  -- Reporting failure for an unknown token would invite somebody to sit
  -- and probe for valid ones.
  return v_hit > 0;
end;
$$;

revoke all on function public.email_unsubscribe(uuid) from public;
grant execute on function public.email_unsubscribe(uuid) to anon, authenticated;

-- ------------------------------------------------------------- backfill
--
-- Everyone gets a row, so the account toggle has something to write and
-- the join above does not silently skip people. weekly_deadline stays
-- false for all of them: this backfill creates the ability to opt in,
-- not the fact of having opted in.
insert into public.email_prefs (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

-- And for everyone who signs up from here on. Separate from
-- handle_new_user so that a change to email preferences never risks the
-- function that creates profiles.
create or replace function public.ensure_email_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_prefs (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_email_prefs on public.profiles;
create trigger profiles_ensure_email_prefs
  after insert on public.profiles for each row execute function public.ensure_email_prefs();
