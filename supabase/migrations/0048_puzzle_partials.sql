-- Give the daily puzzle real partial matches.
--
-- Before this, three of the four text columns were hit-or-miss and only
-- the numbers could ever come back yellow. That is a board where most of
-- the colour is grey and a near-miss looks identical to a wild guess.
--
-- What can now go yellow, and why each one is a fact worth learning:
--
--   DIV      right conference, wrong division. AFC East against AFC
--            North is genuinely closer than AFC East against NFC West,
--            and under the old rule those were the same colour. This is
--            also the ONLY place conference reaches the board - the
--            conference column is computed but never drawn - so without
--            it that information had nowhere to go.
--
--   POS      same position group. Guess a corner when the answer is a
--            safety and you have found the secondary.
--
--   COLLEGE  same athletic conference. Utah against BYU is Big 12 twice.
--            Two players sharing a college is rare enough that the
--            column was almost always grey; sharing a conference is not.
--
-- TEAM stays hit-or-miss on purpose. "Same division" is what a yellow
-- team cell would mean, and the DIV column already says that - one fact,
-- one column.

-- The college conference table. Generated from
-- src/data/collegeConferences.ts, which carries the reasoning about
-- realignment and the two judgement calls (Notre Dame is listed as ACC;
-- schools are listed at their current conference, not their historical
-- one). Load supabase/seeds/college_conferences.sql after this.
--
-- A college with no row here simply never goes yellow, which is the
-- intended handling for Division II, Division III and Canadian schools:
-- bucketing them all together would make Ferris State and Tusculum
-- "the same conference".
create table if not exists public.college_conferences (
  college text primary key,
  conference text not null
);

alter table public.college_conferences enable row level security;
revoke all on public.college_conferences from public;

-- Position groups. Deliberately tight: these are the groupings where
-- knowing the group is real progress toward the player.
--
-- LB and QB are groups of one, so they stay hit-or-miss. That is correct
-- rather than an omission - "some kind of linebacker" is what the LB
-- label already says.
create or replace function public.puzzle_position_group(p_position text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p_position, ''))
    when 'OT' then 'OL' when 'G'  then 'OL' when 'C'  then 'OL'
    when 'DE' then 'DL' when 'DT' then 'DL'
    when 'CB' then 'DB' when 'S'  then 'DB'
    when 'RB' then 'BACKFIELD' when 'FB' then 'BACKFIELD'
    when 'WR' then 'RECEIVER'  when 'TE' then 'RECEIVER'
    when 'PK' then 'SPECIALIST' when 'P' then 'SPECIALIST' when 'LS' then 'SPECIALIST'
    else null
  end;
$$;

create or replace function public.puzzle_compare(p_guess text, p_answer text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  g public.puzzle_players%rowtype;
  a public.puzzle_players%rowtype;
  v_g_group text;
  v_a_group text;
  v_g_conf text;
  v_a_conf text;
  function_result jsonb;
begin
  select * into g from public.puzzle_players where espn_id = p_guess;
  select * into a from public.puzzle_players where espn_id = p_answer;
  if g.espn_id is null or a.espn_id is null then
    raise exception 'Unknown player';
  end if;

  v_g_group := public.puzzle_position_group(g.position);
  v_a_group := public.puzzle_position_group(a.position);

  select conference into v_g_conf from public.college_conferences where college = g.college;
  select conference into v_a_conf from public.college_conferences where college = a.college;

  function_result := jsonb_build_object(
    'espnId', g.espn_id,
    'name', g.name,
    'correct', g.espn_id = a.espn_id,
    'team', jsonb_build_object('value', g.team, 'status', case when g.team = a.team then 'hit' else 'miss' end),
    'conference', jsonb_build_object(
      'value', g.conference,
      'status', case when g.conference = a.conference then 'hit' else 'miss' end
    ),
    -- Division is still compared as the whole thing for a HIT - "East"
    -- in the NFC is not "East" in the AFC - but a shared conference is
    -- now worth a yellow instead of being thrown away as a miss.
    'division', jsonb_build_object(
      'value', g.conference || ' ' || g.division,
      'status', case
        when g.conference = a.conference and g.division = a.division then 'hit'
        when g.conference = a.conference then 'close'
        else 'miss'
      end
    ),
    'position', jsonb_build_object(
      'value', g.position,
      'status', case
        when g.position = a.position then 'hit'
        when v_g_group is not null and v_g_group = v_a_group then 'close'
        else 'miss'
      end
    )
  );

  function_result := function_result
    || public.puzzle_num('height', g.height_in, a.height_in, 2)
    || public.puzzle_num('weight', g.weight_lb, a.weight_lb, 15)
    || public.puzzle_num('age', g.age, a.age, 2)
    || public.puzzle_num('jersey', g.jersey, a.jersey, 5)
    || jsonb_build_object('college', jsonb_build_object(
         'value', g.college,
         'status', case
           when g.college is null or a.college is null then 'unknown'
           when g.college = a.college then 'hit'
           -- Both sides have to be mapped. An unmapped college is not
           -- "not the same conference", it is "we do not know", and
           -- painting that yellow would invent a hint.
           when v_g_conf is not null and v_g_conf = v_a_conf then 'close'
           else 'miss'
         end,
         'direction', null
       ));

  return function_result;
end;
$$;

revoke all on function public.puzzle_position_group(text) from public;
revoke all on function public.puzzle_compare(text, text) from public;
