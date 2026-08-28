-- A second email preference: game updates, separate from pick reminders.
--
-- WHY TWO AND NOT ONE. The existing toggle says "Pick reminders", and it
-- means it: one email when a week is about to lock. A note saying "we
-- built a new game" is a different thing, and sending it under that
-- switch would make the label a lie - which is the precise move that
-- turns an unsubscribe into a spam complaint. Somebody who wants the
-- deadline nudge and nothing else can now have exactly that, and
-- somebody who wants to hear about new games but does not play the
-- weekly card can have that instead.
--
-- ON BY DEFAULT, like weekly_deadline in 0053 and for the same reason: a
-- preference that starts off has nobody in it, and an announcement
-- channel with no subscribers is not a channel. What makes that
-- defensible is unchanged - a working unsubscribe that needs no login,
-- a visible toggle in the account page, and mail that is actually about
-- the thing people signed up for.

alter table public.email_prefs
  add column if not exists product_news boolean not null default true;

-- Existing rows predate the column and took the default, but say it out
-- loud rather than trusting that: a row added between 0052 and here by
-- some other path would otherwise sit at whatever it sat at.
update public.email_prefs set product_news = true where product_news is null;

-- Column-level UPDATE, the same shape 0052 uses. The revoke first is
-- what makes the narrow grant mean anything, and it has to name every
-- writable column each time because a bare `grant update` would hand
-- over unsubscribe_token with it.
revoke update on table public.email_prefs from anon, authenticated;
grant update (weekly_deadline, product_news, updated_at) on table public.email_prefs to authenticated;

-- ------------------------------------------------------- unsubscribe
--
-- ONE CLICK STILL MEANS ALL OF IT.
--
-- The tempting design is a per-stream unsubscribe: the link in a
-- reminder silences reminders, the link in an announcement silences
-- announcements. It is more precise and it is the wrong default. Somebody
-- clicking unsubscribe in an inbox has decided they are done, and
-- handing them a link that turns off one of two things means the next
-- email still arrives - at which point they do not hunt for the other
-- switch, they press the button marked spam, and that costs the sending
-- domain rather than costing the list one address.
--
-- So the link means everything, the /unsubscribe page says so plainly,
-- and anybody who wanted only one of them can turn the other back on
-- from the account page. Precision lives where there is a session to
-- make it with.
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
     set weekly_deadline = false, product_news = false, updated_at = now()
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

-- ------------------------------------------------------ announcements
--
-- Who should hear about a new game. Deliberately NOT
-- weekly_deadline_recipients with a different filter: that one is about
-- an unfinished card in an open week, and this one has nothing to do
-- with picks at all. Sharing a function between them would mean one
-- query trying to answer two unrelated questions.
--
-- p_kind is the campaign's own name - 'announcement:nameplate-launch' -
-- and it does double duty. It is what the ledger records, so the same
-- announcement cannot go out twice however many times the job runs, and
-- it is checked here so a typo produces an empty set rather than a
-- second send to everybody.
create or replace function public.announcement_recipients(
  p_token text,
  p_kind text
)
returns table (user_id uuid, email text, display_name text, unsub_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
begin
  select token into v_expected from public.sync_secrets where name = 'email_sender';
  if v_expected is null or coalesce(p_token, '') = '' or p_token <> v_expected then
    raise exception 'Not authorized';
  end if;
  -- Prefixed rather than whitelisted one by one, because the whole point
  -- is that a new campaign is a new name and not a new migration. The
  -- prefix is still enforced: an empty or wrongly-shaped kind would make
  -- the ledger's uniqueness meaningless, and 'weekly_deadline' must never
  -- reach this function by accident.
  if p_kind is null or p_kind !~ '^announcement:[a-z0-9-]{3,60}$' then
    raise exception 'Kind must look like announcement:some-campaign-name, got: %', coalesce(p_kind, '(null)');
  end if;

  return query
  select p.id,
         u.email::text,
         coalesce(nullif(p.display_name, ''), p.username, 'there'),
         e.unsubscribe_token
    from public.profiles p
    join public.email_prefs e on e.user_id = p.id and e.product_news
    join auth.users u on u.id = p.id
   where u.email is not null
     -- A confirmed address only. Mailing an unconfirmed signup is how
     -- you deliver to somebody who never asked and never verified.
     and u.email_confirmed_at is not null
     and not exists (
       select 1 from public.email_sends s
        where s.user_id = p.id and s.kind = p_kind
     );
end;
$$;

revoke all on function public.announcement_recipients(text, text) from public;
-- The sender arrives through PostgREST as anon. Granting EXECUTE only
-- buys the right to attempt the call; the token check above is the lock.
-- Omitting this grant is what broke the reminder sender - see 0055.
grant execute on function public.announcement_recipients(text, text) to anon, authenticated;
