-- How many people opened each category, alongside how many saved one.
--
-- 0030 already counts distinct savers per template ("340 RANKED"). That
-- number is honest but slow-moving and heavily filtered: it only counts
-- people who signed in AND finished AND pressed Save. A category can be
-- the most-opened thing on the site and still read as empty. This is the
-- other half - the number of times somebody actually landed on the board.
--
-- Deliberately a single counter per template, not a row per visit. There
-- is nothing to query across, no per-user view history anyone asked for,
-- and a visits table open to anonymous inserts is unbounded storage
-- someone else controls. One integer per category cannot grow.
create table if not exists public.tier_list_views (
  template text primary key,
  views bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.tier_list_views enable row level security;
-- No policies and no grants on purpose. RLS with zero policies denies
-- everything, and both directions below run as definer, so the table is
-- reachable only through the two functions - a client cannot read it,
-- write it, or set a number directly.

-- The only writer. Takes a slug and adds one; returns nothing, so it
-- gives a caller no information and there is nothing to await.
--
-- What this is NOT: a trustworthy metric. It is executable by anon,
-- because the hub and the boards are readable signed out and a view
-- count that only counted signed-in people would be a different number
-- wearing the same label. Anyone willing to script the endpoint can
-- inflate their favourite category. That is an acceptable trade here
-- because the number is social proof and a sort order and nothing else -
-- it awards no points, gates nothing, and is never used to decide who
-- won anything. Do not grow a feature on top of it that assumes it is
-- accurate.
create or replace function public.record_tier_list_view(p_template text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Shape check, not an existence check: templates live in the app, not
  -- the database. Bounded length and a slug charset are enough to stop
  -- the table being used as free key-value storage, and a bad slug is
  -- ignored rather than raised - a broken counter must never break the
  -- page that called it.
  if p_template is null or length(p_template) > 40 or p_template !~ '^[a-z0-9-]+$' then
    return;
  end if;

  insert into public.tier_list_views as v (template, views)
  values (p_template, 1)
  on conflict (template) do update
    set views = v.views + 1, updated_at = now();
end;
$$;

revoke all on function public.record_tier_list_view(text) from public;
grant execute on function public.record_tier_list_view(text) to anon, authenticated;

-- Both counters in one round trip, so the hub doesn't make two calls to
-- draw one line of text. Full outer join because the two sides are
-- genuinely independent: a category can be opened and never saved (new),
-- or saved and never opened again (0030 predates this table, so every
-- existing count starts with zero views).
create or replace function public.tier_list_stats()
returns table (template text, people bigint, views bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(r.template, v.template),
    coalesce(r.people, 0)::bigint,
    coalesce(v.views, 0)::bigint
  from (
    select t.template, count(distinct t.user_id) as people
    from public.tier_lists t
    group by t.template
  ) r
  full outer join public.tier_list_views v on v.template = r.template;
$$;

revoke all on function public.tier_list_stats() from public;
grant execute on function public.tier_list_stats() to anon, authenticated;
