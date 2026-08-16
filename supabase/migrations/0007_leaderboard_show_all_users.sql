-- Leaderboard now starts from profiles (left join) instead of
-- weekly_picks (inner join), so every signed-up user with a username
-- shows up - tied at 0-0 - even before any results are published, rather
-- than only appearing once they have at least one graded pick.
drop view if exists public.leaderboard;
create view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.avatar_url,
  coalesce(agg.correct, 0) as correct,
  coalesce(agg.graded, 0) as graded
from public.profiles p
left join (
  select
    wp.user_id,
    count(*) filter (where wp.team_abbr = gr.winner)::int as correct,
    count(*)::int as graded
  from public.weekly_picks wp
  join public.weeks w on w.week = wp.week and w.results_published = true
  join public.game_results gr on gr.game_id = wp.game_id
  group by wp.user_id
) agg on agg.user_id = p.id
where p.username is not null;

grant select on public.leaderboard to anon, authenticated;
