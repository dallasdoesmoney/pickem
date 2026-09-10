import { supabase } from "@/lib/supabase/client";
import { TeamAbbr } from "@/data/teams";
import { TeamScheduleRow } from "@/lib/teamSchedule";

export type WeeklyPicksResult = { picks: Record<string, TeamAbbr>; lockedGameId: string | null };

export async function fetchWeeklyPicks(userId: string, week: number): Promise<WeeklyPicksResult> {
  const { data, error } = await supabase.from("weekly_picks").select("game_id, team_abbr, is_lock").eq("user_id", userId).eq("week", week);
  if (error) throw error;
  const picks: Record<string, TeamAbbr> = {};
  let lockedGameId: string | null = null;
  for (const row of data as { game_id: string; team_abbr: TeamAbbr; is_lock: boolean }[]) {
    picks[row.game_id] = row.team_abbr;
    if (row.is_lock) lockedGameId = row.game_id;
  }
  return { picks, lockedGameId };
}

// Persist exactly what is on the board, without ever passing through a
// state where it is gone.
//
// This used to delete the week and then insert it back. That reads as one
// operation and is really two round trips, which cost us twice in one
// day: when the insert was refused the delete had already committed and
// the board was empty, and when two writers overlapped - the device-copy
// restore and the page's autosave - each one's delete landed between the
// other's delete and insert, so somebody got an error on a save that had
// nothing wrong with it.
//
// Three narrow statements instead, ordered so that no failure and no
// interleaving can lose a pick:
//
//   1. release a lock that has moved     - fails: nothing has changed yet
//   2. upsert the board                  - fails: nothing has been deleted
//   3. delete only what was un-picked    - fails: every pick still stands
//
// Nothing here is destructive until after the writes have succeeded, and
// every statement is idempotent, so running this twice at once converges
// instead of colliding. `openGameIds` keeps all three off games that have
// already kicked off - RLS would refuse those anyway, and the point of
// the lock is that a started game is not touched in either direction.
export async function saveWeeklyPicks(
  userId: string,
  week: number,
  picks: Record<string, TeamAbbr>,
  lockedGameId: string | null,
  openGameIds: Set<string>,
) {
  const open = [...openGameIds];
  // Nothing left open this week: every statement below would be refused,
  // and none of them would mean anything.
  if (open.length === 0) return;

  // 1. weekly_picks_one_lock_per_week is a partial unique index, so two
  //    rows claiming is_lock at the same instant is a constraint
  //    violation, not last-write-wins. The old claim has to be given up
  //    before the new one is written - and this is an update, so it can
  //    only ever clear a flag, never remove a pick.
  let releaseLock = supabase
    .from("weekly_picks")
    .update({ is_lock: false })
    .eq("user_id", userId)
    .eq("week", week)
    .eq("is_lock", true);
  if (lockedGameId) releaseLock = releaseLock.neq("game_id", lockedGameId);
  const { error: lockError } = await releaseLock;
  if (lockError) throw lockError;

  // 2. One statement, so a row that is refused takes only itself down -
  //    the reason a whole slate could vanish over a single bad row before
  //    was that the refusal rolled back an insert the delete had already
  //    made necessary.
  const rows = Object.entries(picks)
    .filter(([gameId]) => openGameIds.has(gameId))
    .map(([gameId, teamAbbr]) => ({
      user_id: userId,
      week,
      game_id: gameId,
      team_abbr: teamAbbr,
      is_lock: gameId === lockedGameId,
    }));
  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("weekly_picks")
      .upsert(rows, { onConflict: "user_id,week,game_id" });
    if (upsertError) throw upsertError;
  }

  // 3. "Save" still means "the board as it stands", so a game toggled
  //    back off has to lose its row - but only that game. Naming the
  //    un-picked games explicitly is what makes this incapable of
  //    deleting a pick the user still has, however it is interleaved.
  const unpicked = open.filter((gameId) => !picks[gameId]);
  if (unpicked.length > 0) {
    const { error: deleteError } = await supabase
      .from("weekly_picks")
      .delete()
      .eq("user_id", userId)
      .eq("week", week)
      .in("game_id", unpicked);
    if (deleteError) throw deleteError;
  }
}

export async function fetchSeasonPicks(userId: string, trackedTeam: TeamAbbr): Promise<Record<number, TeamAbbr>> {
  const { data, error } = await supabase.from("season_picks").select("week, predicted_winner").eq("user_id", userId).eq("tracked_team", trackedTeam);
  if (error) throw error;
  const picks: Record<number, TeamAbbr> = {};
  for (const row of data as { week: number; predicted_winner: TeamAbbr }[]) {
    picks[row.week] = row.predicted_winner;
  }
  return picks;
}

export async function saveSeasonPicks(userId: string, trackedTeam: TeamAbbr, picks: Record<number, TeamAbbr>) {
  const { error: deleteError } = await supabase.from("season_picks").delete().eq("user_id", userId).eq("tracked_team", trackedTeam);
  if (deleteError) throw deleteError;

  const rows = Object.entries(picks).map(([week, winner]) => ({
    user_id: userId,
    tracked_team: trackedTeam,
    week: Number(week),
    predicted_winner: winner,
  }));
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("season_picks").insert(rows);
  if (insertError) throw insertError;
}

// A week's game belongs to two teams' schedules at once, so a pick made
// on one team's predictor should show up on the other team's predictor
// too - nobody should have to remember what they already predicted from
// the other side. Upsert (not delete-then-insert) and additive only: a
// week left blank here is just skipped, never used to delete the
// opponent's row, since that team may have saved that same week
// independently and there's no way to tell "never picked" apart from
// "intentionally cleared."
export async function syncOpponentSeasonPicks(userId: string, trackedTeam: TeamAbbr, picks: Record<number, TeamAbbr>, schedule: TeamScheduleRow[]) {
  const rows = schedule.flatMap((row) => {
    if ("bye" in row) return [];
    const winner = picks[row.week];
    if (!winner) return [];
    const opponent = row.away === trackedTeam ? row.home : row.away;
    return [{ user_id: userId, tracked_team: opponent, week: row.week, predicted_winner: winner }];
  });
  if (rows.length === 0) return;

  const { error } = await supabase.from("season_picks").upsert(rows, { onConflict: "user_id,tracked_team,week" });
  if (error) throw error;
}
