-- Brings display_name back as a user-editable, non-unique field (the
-- column and its update grant already existed, unused, since the
-- username feature shipped). Format check mirrors username's - length
-- cap plus the same profanity backstop - but allows spaces/punctuation
-- and, unlike username, allows empty string (every existing row already
-- defaults to '').
alter table public.profiles drop constraint if exists profiles_display_name_format;
alter table public.profiles add constraint profiles_display_name_format
  check (
    display_name = '' or (
      char_length(display_name) <= 30
      and display_name !~* '(fuck|shit|bitch|asshole|cunt|nigger|nigga|faggot|retard|whore|slut|rape|nazi|hitler|pussy)'
    )
  );

-- Leaderboard now also exposes display_name, so the app can show it as
-- the primary label while keeping username available for the detail page.
drop view if exists public.leaderboard;
create view public.leaderboard as
select
  p.id as user_id,
  p.username,
  p.display_name,
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
