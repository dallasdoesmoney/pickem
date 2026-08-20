-- The number that actually answers "how many people used this list".
--
-- There were two, and both miss. Saves (0030) require a sign-in, a
-- finished board and a press of Save, so they undercount by a lot -
-- everyone who dragged thirty-two teams into tiers, screenshotted it and
-- left counted as nobody. Views (0035) overcount just as badly: they
-- count landing on the page and bouncing.
--
-- A build sits between them: somebody made at least one real change to
-- this board. No account needed, which is the whole point - the boards
-- are fully usable signed out and that is where most of the ranking
-- happens.
alter table public.tier_list_views add column if not exists builds bigint not null default 0;

-- Same posture as record_tier_list_view: the only writer, definer, no
-- grants on the table itself, shape-checked slug, silent on bad input.
-- Same caveat too - it is callable signed out because the boards are,
-- so it is a popularity signal and not a fact. Nothing with stakes may
-- be built on it.
create or replace function public.record_tier_list_build(p_template text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_template is null or length(p_template) > 40 or p_template !~ '^[a-z0-9-]+$' then
    return;
  end if;

  insert into public.tier_list_views as v (template, builds)
  values (p_template, 1)
  on conflict (template) do update
    set builds = v.builds + 1, updated_at = now();
end;
$$;

revoke all on function public.record_tier_list_build(text) from public;
grant execute on function public.record_tier_list_build(text) to anon, authenticated;

-- Dropped rather than replaced: a new OUT column changes the function's
-- result type, and create-or-replace refuses that (42P13).
drop function if exists public.tier_list_stats();

create function public.tier_list_stats()
returns table (template text, people bigint, views bigint, builds bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce(r.template, v.template),
    coalesce(r.people, 0)::bigint,
    coalesce(v.views, 0)::bigint,
    coalesce(v.builds, 0)::bigint
  from (
    select t.template, count(distinct t.user_id) as people
    from public.tier_lists t
    group by t.template
  ) r
  full outer join public.tier_list_views v on v.template = r.template;
$$;

revoke all on function public.tier_list_stats() from public;
grant execute on function public.tier_list_stats() to anon, authenticated;
