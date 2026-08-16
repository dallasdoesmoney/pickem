import { supabase } from "@/lib/supabase/client";

export type UserBadge = { badge_key: string; awarded_at: string };

export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
  const { data, error } = await supabase.from("user_badges").select("badge_key, awarded_at").eq("user_id", userId);
  if (error) throw error;
  return data as UserBadge[];
}
