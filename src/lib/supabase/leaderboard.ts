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
    .order("correct", { ascending: false })
    .order("graded", { ascending: true })
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
