import { supabase } from "@/lib/supabase/client";
import { TeamAbbr } from "@/data/teams";

// One team per key, value = number of distinct weeks predicted for it -
// small enough (max 32 teams x 18 weeks) to just fetch every row and
// group client-side rather than needing a dedicated aggregate view.
export async function fetchPredictorProgress(userId: string): Promise<Partial<Record<TeamAbbr, number>>> {
  const { data, error } = await supabase.from("season_picks").select("tracked_team, week").eq("user_id", userId);
  if (error) throw error;

  const weeksByTeam = new Map<TeamAbbr, Set<number>>();
  for (const row of data as { tracked_team: TeamAbbr; week: number }[]) {
    if (!weeksByTeam.has(row.tracked_team)) weeksByTeam.set(row.tracked_team, new Set());
    weeksByTeam.get(row.tracked_team)!.add(row.week);
  }

  const result: Partial<Record<TeamAbbr, number>> = {};
  for (const [team, weeks] of weeksByTeam) result[team] = weeks.size;
  return result;
}

// Idempotent - safe to call any time (page load, after a save) to grant
// credit for any team that's now fully filled in and wasn't already paid
// out. See supabase/schema.sql for the actual award logic.
export async function syncPredictorAchievements(): Promise<void> {
  const { error } = await supabase.rpc("sync_predictor_achievements");
  if (error) throw error;
}
