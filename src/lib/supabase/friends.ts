import { supabase } from "@/lib/supabase/client";

export type FriendshipStatus = {
  id: string;
  status: "pending" | "accepted";
  requester_id: string;
  addressee_id: string;
} | null;

export type FriendRequest = {
  id: string;
  requester_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

// Any relationship between the two, in either direction - RLS on
// friendships already restricts reads to rows the caller is a party to,
// so this only ever succeeds for "me and someone else," never two
// arbitrary strangers.
export async function fetchFriendshipStatus(myId: string, otherId: string): Promise<FriendshipStatus> {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, status, requester_id, addressee_id")
    .or(`and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`)
    .maybeSingle();
  if (error) throw error;
  return data as FriendshipStatus;
}

export async function sendFriendRequest(requesterId: string, addresseeId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("friendships").insert({ requester_id: requesterId, addressee_id: addresseeId });
  if (error) {
    if (error.code === "23505") return { error: "A friend request already exists between you two." };
    return { error: "Couldn't send that request. Try again." };
  }
  return { error: null };
}

export async function acceptFriendRequest(requestId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("friendships").update({ status: "accepted" }).eq("id", requestId);
  if (error) return { error: "Couldn't accept that request. Try again." };
  return { error: null };
}

// Covers declining a pending request, canceling one you sent, and
// unfriending an accepted one - all the same delete from the DB's side.
export async function removeFriendship(requestId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("friendships").delete().eq("id", requestId);
  if (error) return { error: "Couldn't remove that. Try again." };
  return { error: null };
}

// Requester identity (username/avatar/display name) can't come from a
// direct profiles join - profiles_select_own would block reading anyone
// else's row. The leaderboard view is already public, so it doubles as
// the safe lookup for "who is this user_id."
export async function fetchIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const { data: requests, error } = await supabase
    .from("friendships")
    .select("id, requester_id, created_at")
    .eq("addressee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const ids = requests.map((r) => r.requester_id);
  const { data: profiles, error: profilesError } = await supabase.from("leaderboard").select("user_id, username, display_name, avatar_url").in("user_id", ids);
  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return requests
    .map((r) => {
      const p = byId.get(r.requester_id);
      if (!p) return null;
      return { id: r.id, requester_id: r.requester_id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, created_at: r.created_at };
    })
    .filter((x): x is FriendRequest => x !== null);
}

export async function fetchPendingRequestCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from("friendships").select("id", { count: "exact", head: true }).eq("addressee_id", userId).eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

// The "other" user_id for each of my accepted friendships - used to
// filter the (already public) leaderboard down to a friends view, so no
// new cross-user read capability is needed for that at all.
export async function fetchMyFriendIds(myId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("friendships").select("requester_id, addressee_id").eq("status", "accepted").or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of (data ?? []) as { requester_id: string; addressee_id: string }[]) {
    ids.add(row.requester_id === myId ? row.addressee_id : row.requester_id);
  }
  return ids;
}
