import { supabase } from "@/lib/supabase/client";

// The follow recommendations. Deliberately no RPC: user_badges,
// creator_links, follows and the leaderboard view are all publicly
// selectable already, so this is four ordinary reads rather than another
// security-definer surface to maintain.

export type TopCreator = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  total_points: number;
  platforms: string[];
};

// Ordered by level, which is derived from total_points - so "top N"
// re-sorts itself as people play, with no list to curate.
//
// Excludes the caller (recommending yourself is nonsense) and anyone they
// already follow (recommending a follow they've made is worse than
// nonsense - it looks broken). Both exclusions happen before the limit,
// so filtering someone out promotes the next creator up rather than
// leaving a gap.
export async function fetchTopCreators(myId: string | null, limit = 3): Promise<TopCreator[]> {
  const { data: badgeRows, error: badgeError } = await supabase
    .from("user_badges")
    .select("user_id")
    .eq("badge_key", "creator");
  if (badgeError) throw badgeError;

  let ids = (badgeRows ?? []).map((r) => (r as { user_id: string }).user_id);
  if (ids.length === 0) return [];

  if (myId) {
    const { data: followRows, error: followError } = await supabase
      .from("follows")
      .select("followee_id")
      .eq("follower_id", myId);
    if (followError) throw followError;
    const following = new Set((followRows ?? []).map((r) => (r as { followee_id: string }).followee_id));
    ids = ids.filter((id) => id !== myId && !following.has(id));
  }
  if (ids.length === 0) return [];

  // The leaderboard view already filters to accounts with a username,
  // which is exactly the set that can be meaningfully followed.
  const { data: rows, error } = await supabase
    .from("leaderboard")
    .select("user_id, username, display_name, avatar_url, total_points")
    .in("user_id", ids)
    .order("total_points", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const creators = (rows ?? []) as Omit<TopCreator, "platforms">[];
  if (creators.length === 0) return [];

  // One query for every creator's links rather than one per creator.
  const { data: linkRows } = await supabase
    .from("creator_links")
    .select("user_id, platform")
    .in(
      "user_id",
      creators.map((c) => c.user_id),
    );

  const byUser = new Map<string, string[]>();
  for (const row of (linkRows ?? []) as { user_id: string; platform: string }[]) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id)!.push(row.platform);
  }

  return creators.map((c) => ({ ...c, platforms: byUser.get(c.user_id) ?? [] }));
}
