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

// Same return shape as fetchPredictorProgress above, but works for ANY
// user_id - season_picks is locked to "select own," so a public profile
// page needs the security-definer public_predictor_progress RPC instead.
// Reuses the same client-side completion logic (REQUIRED_PREDICTOR_WEEKS)
// as the achievements tab rather than duplicating that threshold in SQL.
export async function fetchPublicPredictorProgress(userId: string): Promise<Partial<Record<TeamAbbr, number>>> {
  const { data, error } = await supabase.rpc("public_predictor_progress", { p_user_id: userId });
  if (error) throw error;

  const result: Partial<Record<TeamAbbr, number>> = {};
  for (const row of data as { tracked_team: TeamAbbr; weeks_picked: number }[]) result[row.tracked_team] = row.weeks_picked;
  return result;
}

// Idempotent - safe to call any time (page load, after a save) to grant
// credit for any team that's now fully filled in and wasn't already paid
// out. See supabase/schema.sql for the actual award logic.
export async function syncPredictorAchievements(): Promise<void> {
  const { error } = await supabase.rpc("sync_predictor_achievements");
  if (error) throw error;
}

// week -> number of distinct games picked that week - fetched in one
// query across every week rather than one call per week.
export async function fetchWeeklyPickemProgress(userId: string): Promise<Partial<Record<number, number>>> {
  const { data, error } = await supabase.from("weekly_picks").select("week, game_id").eq("user_id", userId);
  if (error) throw error;

  const gamesByWeek = new Map<number, Set<string>>();
  for (const row of data as { week: number; game_id: string }[]) {
    if (!gamesByWeek.has(row.week)) gamesByWeek.set(row.week, new Set());
    gamesByWeek.get(row.week)!.add(row.game_id);
  }

  const result: Partial<Record<number, number>> = {};
  for (const [week, games] of gamesByWeek) result[week] = games.size;
  return result;
}

// Idempotent, same reasoning as syncPredictorAchievements.
export async function syncWeeklyPickemAchievements(): Promise<void> {
  const { error } = await supabase.rpc("sync_weekly_pickem_achievements");
  if (error) throw error;
}

// Same shape as fetchWeeklyPickemProgress above, but works for ANY
// user_id via the public_weekly_pickem_progress RPC (weekly_picks is
// locked to "select own").
export async function fetchPublicWeeklyPickemProgress(userId: string): Promise<Partial<Record<number, number>>> {
  const { data, error } = await supabase.rpc("public_weekly_pickem_progress", { p_user_id: userId });
  if (error) throw error;

  const result: Partial<Record<number, number>> = {};
  for (const row of data as { week: number; games_picked: number }[]) result[row.week] = row.games_picked;
  return result;
}

// Idempotent - pays out any newly-graded correct locks. Safe to call any
// time results might have just become available; no-ops otherwise.
export async function syncLockBonus(): Promise<void> {
  const { error } = await supabase.rpc("sync_lock_bonus");
  if (error) throw error;
}

// How many times a given point source has paid out. Own-row read -
// point_events is "select own", so this is for your own profile only.
export async function fetchPointSourceCount(userId: string, source: string): Promise<number> {
  const { count, error } = await supabase.from("point_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", source);
  if (error) throw error;
  return count ?? 0;
}

export async function fetchLockBonusCount(userId: string): Promise<number> {
  return fetchPointSourceCount(userId, "lock_correct");
}

// Idempotent, same reasoning as the sync_* functions above: pays out
// every correct pick and every swept week in any week whose results have
// been published, and no-ops for anything already paid.
export async function syncCorrectPicks(): Promise<void> {
  const { error } = await supabase.rpc("sync_correct_picks");
  if (error) throw error;
}

// Idempotent - pays 10 for each season-predictor call that came true in a
// published week.
export async function syncPredictorAccuracy(): Promise<void> {
  const { error } = await supabase.rpc("sync_predictor_accuracy");
  if (error) throw error;
}

// Total weeks a lock was ever SET (correct or not, graded or not) - the
// denominator for the achievements tab's "X/Y locks correct" display.
// weekly_picks' own partial unique index caps this at one per week, so
// it's equivalently "how many weeks you've used your lock." Own-row read,
// no security-definer wrapper needed (weekly_picks_select_own already
// covers it).
export async function fetchLockAttemptCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from("weekly_picks").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_lock", true);
  if (error) throw error;
  return count ?? 0;
}

// Works for ANY user_id via the public_lock_bonus_count RPC (point_events
// is locked to "select own").
export async function fetchPublicLockBonusCount(userId: string): Promise<number> {
  const { data, error } = await supabase.rpc("public_lock_bonus_count", { p_user_id: userId });
  if (error) throw error;
  return (data as number) ?? 0;
}
