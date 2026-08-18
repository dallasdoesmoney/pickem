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

// Upsert on the (user_id, template) unique constraint - Save is idempotent
// and there's exactly one saved list per category for now.
export async function saveTierList(userId: string, state: TierListState): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("tier_lists")
    .upsert(
      { user_id: userId, template: state.template, title: state.title, state },
      { onConflict: "user_id,template" }
    );
  if (error) {
    console.error("Tier list save failed", error);
    return { error: "Couldn't save your tier list. Try again." };
  }
  return { error: null };
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
