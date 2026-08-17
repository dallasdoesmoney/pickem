import { supabase } from "@/lib/supabase/client";

// Idempotent (see claim_referral in supabase/schema.sql) - safe to call
// speculatively any time a pending code is found, no risk of double
// crediting a referrer.
export async function claimReferral(referrerUsername: string): Promise<void> {
  const { error } = await supabase.rpc("claim_referral", { p_referrer_username: referrerUsername });
  if (error) throw error;
}

export async function fetchReferralCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from("point_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("source", "referral");
  if (error) throw error;
  return count ?? 0;
}

export type ReferralRow = {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
};

// Reads straight from profiles (via the fetch_my_referrals security
// definer function) rather than the leaderboard view, since a brand-new
// referee likely hasn't set a username yet - the view would exclude them.
export async function fetchMyReferrals(): Promise<ReferralRow[]> {
  const { data, error } = await supabase.rpc("fetch_my_referrals");
  if (error) throw error;
  return data as ReferralRow[];
}
