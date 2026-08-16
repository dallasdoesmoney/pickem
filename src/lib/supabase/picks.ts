import { supabase } from "@/lib/supabase/client";
import { TeamAbbr } from "@/data/teams";

export async function fetchWeeklyPicks(userId: string, week: number): Promise<Record<string, TeamAbbr>> {
  const { data, error } = await supabase.from("weekly_picks").select("game_id, team_abbr").eq("user_id", userId).eq("week", week);
  if (error) throw error;
  const picks: Record<string, TeamAbbr> = {};
  for (const row of data as { game_id: string; team_abbr: TeamAbbr }[]) {
    picks[row.game_id] = row.team_abbr;
  }
  return picks;
}

// Delete-then-insert for the given scope rather than a diff/upsert - "Save
// & Submit" means "persist exactly what's on screen right now," including
// picks the user toggled back off, which a pure upsert would leave behind
// as stale rows.
export async function saveWeeklyPicks(userId: string, week: number, picks: Record<string, TeamAbbr>) {
  const { error: deleteError } = await supabase.from("weekly_picks").delete().eq("user_id", userId).eq("week", week);
  if (deleteError) throw deleteError;

  const rows = Object.entries(picks).map(([gameId, teamAbbr]) => ({
    user_id: userId,
    week,
    game_id: gameId,
    team_abbr: teamAbbr,
  }));
  if (rows.length === 0) return;

  const { error: insertError } = await supabase.from("weekly_picks").insert(rows);
  if (insertError) throw insertError;
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
