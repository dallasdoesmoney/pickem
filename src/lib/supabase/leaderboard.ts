import { supabase } from "@/lib/supabase/client";

export type LeaderboardRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  correct: number;
  graded: number;
  total_points: number;
};

const COLUMNS = "user_id, username, display_name, avatar_url, correct, graded, total_points";

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select(COLUMNS)
    // Ranked by record first; ties broken by level - total_points is a
    // safe proxy for level here since getLevelInfo's curve is monotonic
    // (more points never means a lower level), so ordering by it directly
    // sorts by level without needing to compute getLevelInfo per row.
    .order("correct", { ascending: false })
    .order("total_points", { ascending: false })
    .order("username", { ascending: true });
  if (error) throw error;
  return data as LeaderboardRow[];
}

export async function fetchLeaderboardEntry(username: string): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase.from("leaderboard").select(COLUMNS).eq("username", username).maybeSingle();
  if (error) throw error;
  return data as LeaderboardRow | null;
}

// By user_id rather than username - the account page's own username field
// can be mid-edit, so this keys off something that can't be ambiguous.
export async function fetchMyLeaderboardEntry(userId: string): Promise<LeaderboardRow | null> {
  const { data, error } = await supabase.from("leaderboard").select(COLUMNS).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data as LeaderboardRow | null;
}

// Batch identity lookup for a set of user_ids whose profiles aren't
// otherwise available (e.g. resolving who's behind an activity feed
// entry) - the leaderboard view is already public.
export async function fetchProfilesByIds(ids: string[]): Promise<Map<string, Pick<LeaderboardRow, "username" | "display_name" | "avatar_url">>> {
  const uniqueIds = Array.from(new Set(ids));
  if (uniqueIds.length === 0) return new Map();
  const { data, error } = await supabase.from("leaderboard").select("user_id, username, display_name, avatar_url").in("user_id", uniqueIds);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.user_id as string, p]));
}
