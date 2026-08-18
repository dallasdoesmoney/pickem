import { supabase } from "@/lib/supabase/client";

export type UserBadge = { badge_key: string; awarded_at: string };

export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase.from("user_badges").select("badge_key, awarded_at").eq("user_id", userId);
  if (error) throw error;
  return data as UserBadge[];
}

// One query for a whole list of rows (a leaderboard page) rather than
// one fetchUserBadges call per row.
export async function fetchCreatorUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const { data, error } = await supabase.from("user_badges").select("user_id").eq("badge_key", "creator").in("user_id", userIds);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.user_id as string));
}
