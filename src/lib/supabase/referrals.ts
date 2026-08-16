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
