import { supabase } from "@/lib/supabase/client";
import { TierListState } from "@/lib/tierList";

export type SavedTierList = {
  id: string;
  template: string;
  title: string;
  state: TierListState;
  updated_at: string;
};

// Row shape for the index. It carries `state` because each saved list is
// shown as a thumbnail of its own board, and the colours and placements
// that thumbnail draws live in the blob. That blob is the biggest column
// in the table, so this is a deliberate cost: a few KB per list, and only
// on a page whose whole job is showing them.
export type SavedTierListSummary = {
  id: string;
  template: string;
  title: string;
  updated_at: string;
  state: TierListState;
};

// Every saved list the signed-in user has, newest touched first. Covered
// by the (user_id, updated_at desc) index from 0027.
export async function listMyTierLists(userId: string): Promise<SavedTierListSummary[]> {
  const { data, error } = await supabase
    .from("tier_lists")
    .select("id, template, title, updated_at, state")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data as SavedTierListSummary[]) ?? [];
}

// One saved list, by id. Scoped to the user as well as the id so a
// guessed id can't be opened - RLS enforces this too, but the editor
// should treat someone else's id as "not found" rather than as an error.
export async function fetchTierList(userId: string, id: string): Promise<SavedTierList | null> {
  const { data, error } = await supabase
    .from("tier_lists")
    .select("id, template, title, state, updated_at")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedTierList) ?? null;
}

// How many distinct people have saved a list in each category, keyed by
// template slug. Goes through a security-definer RPC because RLS limits
// every client to its own rows - see 0030.
//
// Returns an empty map rather than throwing if the function isn't there:
// the counter is a nice-to-have on a card, and the hub must still render
// on a database where 0030 hasn't been run yet.
export async function fetchTierListRankCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc("tier_list_rank_counts");
  if (error) {
    console.warn("Rank counts unavailable", error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const row of (data as { template: string; people: number }[]) ?? []) {
    out[row.template] = Number(row.people) || 0;
  }
  return out;
}

export async function deleteTierList(userId: string, id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from("tier_lists").delete().eq("user_id", userId).eq("id", id);
  if (error) {
    console.error("Tier list delete failed", error);
    return { error: "Couldn't delete that list. Try again." };
  }
  return { error: null };
}

// Saves to `id` when given one, otherwise creates a new list and hands
// back its id so the caller can keep saving to the same row.
//
// Deliberately NOT an upsert. PostgREST compiles .upsert() into
// INSERT ... ON CONFLICT DO UPDATE SET <every column in the payload>, and
// the payload has to carry user_id and template to satisfy the insert
// half. But this table grants UPDATE on only (title, state) - updated_at
// belongs to the trigger and user_id to RLS. Postgres checks column
// privileges statically, so that statement was denied whether or not a
// row actually conflicted, and every save failed with "permission denied
// for table tier_lists". Separate statements each touch only the columns
// the role holds.
// `listName` is what the list is CALLED in your saved lists, and it is
// deliberately not state.title, which is the heading printed on the board
// and on the exported card. They were being written from the same value,
// so naming a save renamed the board. Two columns already existed for
// them; they just needed to stop being fed the same string.
export async function saveTierList(
  userId: string,
  state: TierListState,
  id: string | null | undefined,
  listName: string,
): Promise<{ id: string | null; error: string | null }> {
  const failed = (stage: string, err: unknown) => {
    console.error(`Tier list save failed (${stage})`, err);
    // 23505 here is the unique index on (user_id, template, lower(title)):
    // a name collision, which is the user's to fix, not a failure to
    // retry. Anything else is genuinely unexpected.
    if ((err as { code?: string })?.code === "23505") {
      return { id: null, error: "You already have a list with that name." };
    }
    return { id: null, error: "Couldn't save your tier list. Try again." };
  };

  if (id) {
    const { data, error } = await supabase
      .from("tier_lists")
      .update({ title: listName, state })
      .eq("user_id", userId)
      .eq("id", id)
      .select("id");
    if (error) return failed("update", error);
    if (data && data.length > 0) return { id, error: null };
    // Nothing updated: the list was deleted from another tab or device
    // while this one still had it open. Saving is the more useful answer
    // than erroring, so fall through and re-create it.
  }

  const { data, error } = await supabase
    .from("tier_lists")
    .insert({ user_id: userId, template: state.template, title: listName, state })
    .select("id")
    .single();
  if (error) return failed("insert", error);
  return { id: (data as { id: string }).id, error: null };
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
