import { supabase } from "@/lib/supabase/client";

export type CreatorRequestStatus = "pending" | "approved" | "rejected";

export type CreatorSocial = { platform: string; url: string };

// What the applicant told us, kept as a snapshot on the request row. It
// is deliberately not the same thing as creator_links: those are live and
// editable by the creator, these are what was claimed at review time.
export type CreatorApplication = {
  socials: CreatorSocial[];
  audienceSize: string;
  primaryPlatform: string;
  contentTypes: string[];
  cadence: string;
  nflFocus: string;
  contactHandle: string;
  contentUrl: string;
  note: string;
};

export type CreatorRequest = {
  id: string;
  status: CreatorRequestStatus;
  content_url: string | null;
  note: string | null;
  requested_at: string;
  socials: CreatorSocial[] | null;
  audience_size: string | null;
  primary_platform: string | null;
  content_types: string[] | null;
  cadence: string | null;
  nfl_focus: string | null;
  contact_handle: string | null;
};

const REQUEST_COLUMNS =
  "id, status, content_url, note, requested_at, socials, audience_size, primary_platform, content_types, cadence, nfl_focus, contact_handle";

// Latest request only - a rejected request can be resubmitted, so a
// user could technically have several rows over time, but only the most
// recent one matters for "what should the account page show right now."
export async function fetchMyCreatorRequest(userId: string): Promise<CreatorRequest | null> {
  const { data, error } = await supabase
    .from("creator_requests")
    .select(REQUEST_COLUMNS)
    .eq("user_id", userId)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as CreatorRequest | null;
}

export async function submitCreatorRequest(userId: string, application: CreatorApplication): Promise<{ error: string | null }> {
  const { error } = await supabase.from("creator_requests").insert({
    user_id: userId,
    content_url: application.contentUrl.trim() || null,
    note: application.note.trim() || null,
    // Blank rows are dropped here rather than in the approval function so
    // an admin reviewing the request sees only channels that exist.
    socials: application.socials.filter((s) => s.url.trim() !== "").map((s) => ({ platform: s.platform, url: s.url.trim() })),
    audience_size: application.audienceSize || null,
    primary_platform: application.primaryPlatform || null,
    content_types: application.contentTypes,
    cadence: application.cadence || null,
    nfl_focus: application.nflFocus || null,
    contact_handle: application.contactHandle.trim() || null,
  });
  if (error) {
    if (error.code === "23505") return { error: "You already have a pending request." };
    return { error: "Couldn't submit your application. Try again." };
  }
  return { error: null };
}

export type PendingCreatorRequest = CreatorRequest & { user_id: string; username: string; display_name: string; avatar_url: string | null };

// Admin-only in practice - creator_requests_select_own_or_admin only
// returns other people's rows to an actual admin, so a non-admin caller
// just gets their own (or none).
// Count only, for the badge on the Admin menu entry. head:true means
// PostgREST returns the count in a header and no rows at all, so the nav
// doesn't drag every pending request's payload around on every page load
// just to render a number.
export async function fetchPendingCreatorRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from("creator_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function fetchPendingCreatorRequests(): Promise<PendingCreatorRequest[]> {
  const { data: requests, error } = await supabase
    .from("creator_requests")
    .select(`user_id, ${REQUEST_COLUMNS}`)
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
