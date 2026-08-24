import { supabase } from "@/lib/supabase/client";

export type DiscordClaimResult = {
  // False when it had already been claimed - the normal case on every
  // press after the first.
  awarded: boolean;
  points: number;
};

// Claim the one-off Discord reward. Takes no arguments and names no
// amount: the points and the once-ness both live in the database (see
// supabase/migrations/0044_discord_join.sql), so pressing the button
// twice, or in two tabs, pays once.
//
// Note what this actually attests to: that the invite was opened, not
// that anyone joined. The migration explains why, and what real
// verification would cost.
export async function claimDiscordJoin(): Promise<DiscordClaimResult> {
  const { data, error } = await supabase.rpc("claim_discord_join");
  if (error) throw error;
  const row = (data ?? {}) as Partial<DiscordClaimResult>;
  return { awarded: row.awarded === true, points: Number(row.points ?? 0) };
}
