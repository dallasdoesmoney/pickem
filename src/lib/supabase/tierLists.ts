import { supabase } from "@/lib/supabase/client";
import { TierListState } from "@/lib/tierList";

export type SavedTierList = {
  template: string;
  title: string;
  state: TierListState;
  updated_at: string;
};

export async function fetchMyTierList(userId: string, template: string): Promise<SavedTierList | null> {
  const { data, error } = await supabase
    .from("tier_lists")
    .select("template, title, state, updated_at")
    .eq("user_id", userId)
    .eq("template", template)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedTierList) ?? null;
}

// Update first, insert only if there was nothing to update. There is one
// saved list per (user, template), so this is still idempotent.
//
// NOT an upsert, though the unique constraint invites one. PostgREST
// compiles .upsert() into INSERT ... ON CONFLICT DO UPDATE SET <every
// column in the payload>, and the payload has to carry user_id and
// template to satisfy the insert. But this table deliberately grants
// UPDATE on only (title, state) - updated_at is the trigger's, and
// user_id is RLS's. Postgres checks column privileges statically, so that
// statement is denied outright whether or not a row actually conflicts:
// every save failed with "permission denied for table tier_lists".
//
// Splitting it means each statement touches only columns the role
// actually holds - insert has all four, update has the two it changes -
// so this needs no grant change and no migration.
export async function saveTierList(userId: string, state: TierListState): Promise<{ error: string | null }> {
  const failed = (stage: string, err: unknown) => {
    console.error(`Tier list save failed (${stage})`, err);
    return { error: "Couldn't save your tier list. Try again." };
  };

  const { data: updated, error: updateError } = await supabase
    .from("tier_lists")
    .update({ title: state.title, state })
    .eq("user_id", userId)
    .eq("template", state.template)
    .select("id");
  if (updateError) return failed("update", updateError);
  if (updated && updated.length > 0) return { error: null };

  const { error: insertError } = await supabase
    .from("tier_lists")
    .insert({ user_id: userId, template: state.template, title: state.title, state });
  if (!insertError) return { error: null };

  // Two saves racing: the row appeared between the update and the insert,
  // and the unique constraint caught it. The other write is the same
  // user's, so the resolution is simply to apply this one on top.
  if (insertError.code === "23505") {
    const { error: retryError } = await supabase
      .from("tier_lists")
      .update({ title: state.title, state })
      .eq("user_id", userId)
      .eq("template", state.template);
    return retryError ? failed("retry", retryError) : { error: null };
  }
  return failed("insert", insertError);
}

export type TierListSnapshot = {
  code: string;
  template: string;
  title: string;
  state: TierListState;
  user_id: string | null;
  created_at: string;
};

export async function fetchTierListShare(code: string): Promise<TierListSnapshot | null> {
  const { data, error } = await supabase
    .from("tier_list_shares")
    .select("code, template, title, state, user_id, created_at")
    .eq("code", code)
    .maybeSingle();
  if (error) throw error;
  return (data as TierListSnapshot) ?? null;
}

// Goes through the security-definer RPC rather than a direct insert -
// the table grants nobody insert, so this is the only way in, and it's
// what lets signed-out visitors share without opening the table up.
export async function createTierListShare(state: TierListState): Promise<{ code: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("create_tier_list_share", {
    p_template: state.template,
    p_title: state.title,
    p_state: state,
  });
  if (error) {
    console.error("Share link creation failed", error);
    return { code: null, error: "Couldn't create a share link. Try again." };
  }
  return { code: data as string, error: null };
}
