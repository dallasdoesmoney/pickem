-- Tune what counts as close, after playing it.
--
--   POS     no longer has a yellow at all. The position groups were too
--           generous in practice: "some kind of defensive back" barely
--           narrows a pool where a quarter of the league is a defensive
--           back, and a yellow that does not narrow anything trains
--           people to ignore yellow. Position goes back to hit-or-miss,
--           which is what the label already says plainly.
--
--   AGE     2 years -> 3. Ages cluster hard between 23 and 28, so a
--           two-year band kept landing just outside on guesses that were
--           the right generation of player.
--
--   JERSEY  5 -> 3. The opposite problem: numbers are spread across
--           1-99 with position conventions on top, so a five-wide band
--           was going yellow often enough to stop meaning much.
--
-- puzzle_position_group goes with it. Nothing else calls it, and the
-- groupings are in git if position groups ever come back.

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
  v_g_conf text;
  v_a_conf text;
  function_result jsonb;
begin
  select * into g from public.puzzle_players where espn_id = p_guess;
  select * into a from public.puzzle_players where espn_id = p_answer;
  if g.espn_id is null or a.espn_id is null then
    raise exception 'Unknown player';
  end if;

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
    -- worth a yellow instead of being thrown away as a miss.
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
      'status', case when g.position = a.position then 'hit' else 'miss' end
    )
  );

  function_result := function_result
    || public.puzzle_num('height', g.height_in, a.height_in, 2)
    || public.puzzle_num('weight', g.weight_lb, a.weight_lb, 15)
    || public.puzzle_num('age', g.age, a.age, 3)
    || public.puzzle_num('jersey', g.jersey, a.jersey, 3)
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

revoke all on function public.puzzle_compare(text, text) from public;

drop function if exists public.puzzle_position_group(text);
