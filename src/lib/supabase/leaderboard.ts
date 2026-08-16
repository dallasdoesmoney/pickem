import { supabase } from "@/lib/supabase/client";

export type LeaderboardRow = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  correct: number;
  graded: number;
};

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const { data, error } = await supabase
    .from("leaderboard")
    .select("user_id, username, avatar_url, correct, graded")
    .order("correct", { ascending: false })
    .order("graded", { ascending: true });
  if (error) throw error;
  return data as LeaderboardRow[];
}
