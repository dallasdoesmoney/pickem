import { supabase } from "@/lib/supabase/client";

export type CreatorRequestStatus = "pending" | "approved" | "rejected";

export type CreatorRequest = {
  id: string;
  status: CreatorRequestStatus;
  content_url: string;
  note: string | null;
  requested_at: string;
};

// Latest request only - a rejected request can be resubmitted, so a
// user could technically have several rows over time, but only the most
// recent one matters for "what should the account page show right now."
export async function fetchMyCreatorRequest(userId: string): Promise<CreatorRequest | null> {
  const { data, error } = await supabase
    .from("creator_requests")
    .select("id, status, content_url, note, requested_at")
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CreatorRequest | null;
}

export async function submitCreatorRequest(userId: string, contentUrl: string, note: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("creator_requests").insert({ user_id: userId, content_url: contentUrl, note: note || null });
  if (error) {
    if (error.code === "23505") return { error: "You already have a pending request." };
    return { error: "Couldn't submit your request. Try again." };
  }
  return { error: null };
}

export type PendingCreatorRequest = CreatorRequest & { user_id: string; username: string; display_name: string; avatar_url: string | null };

// Admin-only in practice - creator_requests_select_own_or_admin only
// returns other people's rows to an actual admin, so a non-admin caller
// just gets their own (or none).
export async function fetchPendingCreatorRequests(): Promise<PendingCreatorRequest[]> {
  const { data: requests, error } = await supabase
    .from("creator_requests")
    .select("id, user_id, status, content_url, note, requested_at")
    .eq("status", "pending")
    .order("requested_at", { ascending: true });
  if (error) throw error;
  if (!requests || requests.length === 0) return [];

  const ids = requests.map((r) => r.user_id);
  const { data: profiles, error: profilesError } = await supabase.from("leaderboard").select("user_id, username, display_name, avatar_url").in("user_id", ids);
  if (profilesError) throw profilesError;
  const byId = new Map((profiles ?? []).map((p) => [p.user_id, p]));

  return requests
    .map((r) => {
      const p = byId.get(r.user_id);
      if (!p) return null;
      return { ...r, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url } as PendingCreatorRequest;
    })
    .filter((x): x is PendingCreatorRequest => x !== null);
}

export async function reviewCreatorRequest(requestId: string, approve: boolean): Promise<void> {
  const { error } = await supabase.rpc("review_creator_request", { p_request_id: requestId, p_approve: approve });
  if (error) throw error;
}
