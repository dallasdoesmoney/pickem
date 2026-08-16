import { supabase } from "@/lib/supabase/client";
import { TeamAbbr } from "@/data/teams";

export type WeekRow = { week: number; is_open: boolean; results_published: boolean };

export async function fetchWeeks(): Promise<WeekRow[]> {
  const { data, error } = await supabase.from("weeks").select("week, is_open, results_published").order("week", { ascending: true });
  if (error) throw error;
  return data as WeekRow[];
}

export async function setWeekOpen(week: number, isOpen: boolean) {
  const { error } = await supabase.from("weeks").update({ is_open: isOpen }).eq("week", week);
  if (error) throw error;
}

export async function setWeekResultsPublished(week: number, published: boolean) {
  const { error } = await supabase.from("weeks").update({ results_published: published }).eq("week", week);
  if (error) throw error;
}

export async function fetchGameResults(week: number): Promise<Record<string, TeamAbbr>> {
  const { data, error } = await supabase.from("game_results").select("game_id, winner").eq("week", week);
  if (error) throw error;
  const map: Record<string, TeamAbbr> = {};
  for (const row of data as { game_id: string; winner: TeamAbbr }[]) {
    map[row.game_id] = row.winner;
  }
  return map;
}

export async function setGameResult(gameId: string, week: number, winner: TeamAbbr) {
  const { error } = await supabase.from("game_results").upsert({ game_id: gameId, week, winner }, { onConflict: "game_id" });
  if (error) throw error;
}

export async function clearGameResult(gameId: string) {
  const { error } = await supabase.from("game_results").delete().eq("game_id", gameId);
  if (error) throw error;
}

// Public (non-admin) read used to pick which week the homepage shows.
export async function fetchActiveWeek(): Promise<number | null> {
  const { data, error } = await supabase.from("weeks").select("week").eq("is_open", true).order("week", { ascending: false }).limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].week;
}
