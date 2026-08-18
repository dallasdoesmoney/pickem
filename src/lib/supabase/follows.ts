import { supabase } from "@/lib/supabase/client";

export type FollowStatus = { iFollow: boolean; followsMe: boolean };

// Both directions in one query - follows is publicly readable (see
// supabase/schema.sql), so this works for any pair, not just rows I'm a
// party to.
export async function fetchFollowStatus(myId: string, otherId: string): Promise<FollowStatus> {
  const { data, error } = await supabase
    .from("follows")
    .select("follower_id, followee_id")
    .or(`and(follower_id.eq.${myId},followee_id.eq.${otherId}),and(follower_id.eq.${otherId},followee_id.eq.${myId})`);
  if (error) throw error;
  const rows = (data ?? []) as { follower_id: string; followee_id: string }[];
  return { iFollow: rows.some((r) => r.follower_id === myId), followsMe: rows.some((r) => r.follower_id === otherId) };
}

export async function followUser(followerId: string, followeeId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("follows").insert({ follower_id: followerId, followee_id: followeeId });
  // 23505 (already following - e.g. a double-click race) is a no-op, not a failure.
  if (error && error.code !== "23505") return { error: "Couldn't follow them. Try again." };
  return { error: null };
}

// Unfollowing only ever removes YOUR OWN outgoing edge - if they still
// follow you, the relationship correctly degrades to "follows me," not
// back to nothing. Unlike the old removeFriendship, this can never touch
// the other person's row.
export async function unfollowUser(followerId: string, followeeId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("follows").delete().eq("follower_id", followerId).eq("followee_id", followeeId);
  if (error) return { error: "Couldn't unfollow. Try again." };
  return { error: null };
}

export type FollowerRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

// People who follow me that I don't follow back yet - the notifications
// page's "FOLLOW BACK" section. follows is public RLS, so this is two
// plain reads + a client-side set-difference, same two-request shape as
// fetchMyFriends below (not a security-definer anti-join).
export async function fetchFollowersNotFollowingBack(myId: string): Promise<FollowerRow[]> {
  const [{ data: followers, error: e1 }, { data: following, error: e2 }] = await Promise.all([
    supabase.from("follows").select("follower_id, created_at").eq("followee_id", myId).order("created_at", { ascending: false }),
    supabase.from("follows").select("followee_id").eq("follower_id", myId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const followingIds = new Set((following ?? []).map((r) => r.followee_id));
  const unreciprocated = (followers ?? []).filter((r) => !followingIds.has(r.follower_id));
  if (unreciprocated.length === 0) return [];

  const ids = unreciprocated.map((r) => r.follower_id);
  const { data: profiles, error: profilesError } = await supabase.from("leaderboard").select("user_id, username, display_name, avatar_url").in("user_id", ids);
  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return unreciprocated
    .map((r) => {
      const p = byId.get(r.follower_id);
      if (!p) return null;
      return { user_id: r.follower_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, created_at: r.created_at };
    })
    .filter((x): x is FollowerRow => x !== null);
}

// Everyone who follows me, mutual or not - the Followers list modal's
// full list (contrast fetchFollowersNotFollowingBack, which is the
// narrower "still needs action" subset for the notifications page).
export async function fetchMyFollowers(myId: string): Promise<FollowerRow[]> {
  const { data: followers, error } = await supabase
    .from("follows")
    .select("follower_id, created_at")
    .eq("followee_id", myId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!followers || followers.length === 0) return [];

  const ids = followers.map((r) => r.follower_id);
  const { data: profiles, error: profilesError } = await supabase.from("leaderboard").select("user_id, username, display_name, avatar_url").in("user_id", ids);
  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return followers
    .map((r) => {
      const p = byId.get(r.follower_id);
      if (!p) return null;
      return { user_id: r.follower_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, created_at: r.created_at };
    })
    .filter((x): x is FollowerRow => x !== null);
}

// Anyone's follower count, for public profiles - follows is publicly
// readable, so this is just a plain filtered count, no RPC needed.
export async function fetchPublicFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from("follows").select("*", { count: "exact", head: true }).eq("followee_id", userId);
  if (error) throw error;
  return count ?? 0;
}

// Lighter sibling of the above for the nav badge - count only, no
// profile join.
export async function fetchUnreciprocatedFollowerCount(myId: string): Promise<number> {
  const [{ data: followers, error: e1 }, { data: following, error: e2 }] = await Promise.all([
    supabase.from("follows").select("follower_id").eq("followee_id", myId),
    supabase.from("follows").select("followee_id").eq("follower_id", myId),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;
  const followingIds = new Set((following ?? []).map((r) => r.followee_id));
  return (followers ?? []).filter((r) => !followingIds.has(r.follower_id)).length;
}

// The "other" user_id for each mutual pair - used to filter the (already
// public) leaderboard down to a friends view.
export async function fetchMyFriendIds(myId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("friends").select("friend_id").eq("user_id", myId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.friend_id as string));
}

// Was an RPC (public_friend_count) because friendships was select-own -
// friends is a public view now, so this is just a filtered count.
export async function fetchPublicFriendCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from("friends").select("*", { count: "exact", head: true }).eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

export type FriendRow = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

export async function fetchMyFriends(myId: string): Promise<FriendRow[]> {
  const { data: rows, error } = await supabase.from("friends").select("friend_id").eq("user_id", myId);
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.friend_id as string);
  if (ids.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase.from("leaderboard").select("user_id, username, display_name, avatar_url").in("user_id", ids);
  if (profilesError) throw profilesError;
  return (profiles ?? []) as FriendRow[];
}
