-- Letting a scheduled job post final scores, without handing it the keys.
--
-- Entering results by hand was the only weekly step that broke something
-- visible when it was missed: every scoring view - the leaderboard,
-- points, badges, lock of the week - reads game_results, and nothing
-- wrote to it but a person in the admin panel.
--
-- The obvious way to automate that is the service role key in a CI
-- secret. That key bypasses RLS on every table in the database,
-- including auth.users, so a job whose whole purpose is "set the winner
-- of a football game" would be one leaked secret away from owning
-- everything. This is the smaller door: one function that can write one
-- column on one table, opened by a token that is good for nothing else.
--
-- Note what this deliberately does NOT do: publish. weeks.results_published
-- still gates every scoring view, and it is still a person's decision.
-- The job fills the results in; revealing them stays a deliberate act.

-- Where the token lives. RLS on with NO policies at all, which in
-- Postgres means nobody reaches it - not anon, not authenticated, not an
-- admin. The only way in is a security-definer function, which is the
-- point.
create table if not exists public.sync_secrets (
  name text primary key,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.sync_secrets enable row level security;
revoke all on table public.sync_secrets from anon, authenticated;

-- Post final scores.
--
-- Takes an array of {game_id, week, winner}. Upserts, so re-running is
-- free and a corrected score overwrites a wrong one - the job runs every
-- few hours through a game day and most runs change nothing.
create or replace function public.sync_game_results(p_token text, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected text;
  v_changed integer := 0;
begin
  select token into v_expected from public.sync_secrets where name = 'game_results';
  -- No token configured means the door is shut, not open. Getting this
  -- backwards is how a feature nobody finished ships as a hole.
  if v_expected is null or coalesce(p_token, '') = '' or p_token <> v_expected then
    raise exception 'Not authorized';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Expected an array of results';
  end if;

  insert into public.game_results (game_id, week, winner)
  select
    r->>'game_id',
    (r->>'week')::integer,
    r->>'winner'
  from jsonb_array_elements(p_rows) r
  where coalesce(r->>'game_id', '') <> ''
    and coalesce(r->>'winner', '') <> ''
  on conflict (game_id) do update
    set winner = excluded.winner,
        week = excluded.week
    -- Only when it actually differs, so an unchanged game does not bump
    -- updated_at and the returned count means "this many games moved".
    where public.game_results.winner is distinct from excluded.winner;

  get diagnostics v_changed = row_count;
  return v_changed;
end;
$$;

-- Callable with the anon key, because that is what a CI job presents -
-- but useless without the token, which is the actual credential.
revoke all on function public.sync_game_results(text, jsonb) from public;
grant execute on function public.sync_game_results(text, jsonb) to anon, authenticated;

-- Set the token before the job can do anything. Generate a long random
-- one and put the same value in the repository secret:
--
--   openssl rand -hex 32
--
-- insert into public.sync_secrets (name, token) values ('game_results', 'PASTE_IT_HERE')
--   on conflict (name) do update set token = excluded.token, updated_at = now();
