-- Two reminders per week instead of one.
--
-- 0053 sends a heads-up a day out. That is the right first email - there
-- is time to think about sixteen games - but it is only a heads-up, and
-- somebody who reads it on Saturday and means to get to it later was
-- previously never heard from again: they are in the ledger for the
-- week, so nothing else could reach them.
--
-- The ledger was keyed on (user_id, KIND, reference_id) from the start
-- for exactly this. A second kind coexists with the first rather than
-- being swallowed by it, so "already told about week 3" becomes "already
-- told about week 3 IN THIS WAY" and the last call can land on somebody
-- who has had the heads-up and still not picked.
--
-- The two kinds:
--   weekly_deadline        the day-out heads-up
--   weekly_deadline_final  the last call, inside the final hour
--
-- Anybody who finishes their card after the first email is excluded from
-- the second by the `made < total` test that was always there, so the
-- last call only reaches people it is actually useful to.

-- The old three-argument form hardcoded the kind. Dropped rather than
-- left alongside: changing a function's arguments creates an OVERLOAD,
-- and two functions with the same name doing subtly different things is
-- how a caller ends up silently on the wrong one.
drop function if exists public.weekly_deadline_recipients(text, integer, integer);

create or replace function public.weekly_deadline_recipients(
  p_token text,
  p_week integer,
  p_total_games integer,
  p_kind text
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
  -- Whitelisted rather than free text. The kind decides who is excluded,
  -- so a typo in the caller would quietly re-mail everybody who had
  -- already been told - the failure looks like the feature working.
  if p_kind is null or p_kind not in ('weekly_deadline', 'weekly_deadline_final') then
    raise exception 'Unknown reminder kind: %', coalesce(p_kind, '(null)');
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
     and u.email_confirmed_at is not null
     and coalesce(pk.n, 0) < p_total_games
     -- Scoped to THIS kind, which is the whole change: somebody who has
     -- had the heads-up is still owed the last call.
     and not exists (
       select 1 from public.email_sends s
        where s.user_id = p.id and s.kind = p_kind
          and s.reference_id = p_week::text
     );
end;
$$;

revoke all on function public.weekly_deadline_recipients(text, integer, integer, text) from public, anon, authenticated;
