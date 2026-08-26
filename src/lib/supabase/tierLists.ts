import { supabase } from "@/lib/supabase/client";
import { getTierTemplate } from "@/data/tierTemplates";
import { TierListState, sanitizeState } from "@/lib/tierList";

// A saved blob is a snapshot of a roster that has since moved on. The
// rosters are regenerated from ESPN's depth chart every week, so the week
// a starter changes, every saved board in that category is holding an id
// the template no longer has - and resolveItem draws those as a face with
// no name, because a saved board keeps the ids it was ranked with.
//
// That is exactly what Zach Charbonnet turned into when Jadarian Price
// took Seattle's back slot: still on the board, nameless, and the new
// back nowhere to be found.
//
// So every row is rebuilt against the live template on the way OUT of the
// database rather than at each place that draws one. sanitizeState drops
// ids the template no longer has and drops anyone newly added into the
// pool, which is the behaviour the local draft and the share snapshot
// have always had - this closes the one path that skipped it. Nothing is
// written back: the stored blob keeps its stale id until the owner next
// saves, and nothing reads it unsanitised any more.
//
// An unknown template means the category itself is gone. There is nothing
// to rebuild against, so the row is passed through untouched and the
// callers show it as a category they can't draw.
function rebuild<T extends { template: string; state: TierListState }>(row: T): T {
  const template = getTierTemplate(row.template);
  if (!template) return row;
  const clean = sanitizeState(row.state, template);
  return clean ? { ...row, state: clean } : row;
}

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
  return ((data as SavedTierListSummary[]) ?? []).map(rebuild);
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
  return data ? rebuild(data as SavedTierList) : null;
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

// The three counters for one category, from narrowest to widest:
//
//   people - signed in, finished, pressed Save. Trustworthy: a distinct
//            count of rows nobody could write without an account.
//   builds - made at least one real change to the board. No account
//            needed, which is why it is the number that best answers
//            "how many people used this".
//   views  - landed on the page.
//
// Only `people` is a fact. The other two are callable signed out by
// design (see 0035/0036) and can be padded by anyone willing to script
// the endpoint. Popularity signals, never stakes.
export type TierListStats = { people: number; views: number; builds: number };

// Keyed by template slug, for the hub's cards and their ordering.
//
// Falls back to the older rank-counts RPC when 0035 hasn't been run, and
// to an empty map when neither exists: a counter is a nice-to-have on a
// card, and the hub has to render on any database.
export async function fetchTierListStats(): Promise<Record<string, TierListStats>> {
  const { data, error } = await supabase.rpc("tier_list_stats");
  if (error) {
    console.warn("Tier list stats unavailable, falling back to rank counts", error.message);
    const counts = await fetchTierListRankCounts();
    return Object.fromEntries(
      Object.entries(counts).map(([slug, people]) => [slug, { people, views: 0, builds: 0 }]),
    );
  }
  const out: Record<string, TierListStats> = {};
  // `builds` is read defensively rather than destructured: on a database
  // with 0035 but not 0036 the RPC returns two counters, and a missing
  // column has to read as zero rather than NaN.
  for (const row of (data as { template: string; people: number; views: number; builds?: number }[]) ?? []) {
    out[row.template] = {
      people: Number(row.people) || 0,
      views: Number(row.views) || 0,
      builds: Number(row.builds) || 0,
    };
  }
  return out;
}

// Take a slug's slot in a list of already-counted categories, returning
// false if it was already taken. The two counters use different stores
// on purpose, which is the whole difference in what they mean:
//
//   views  - sessionStorage. "Someone opened this today". A refresh or a
//            bounce back from a share link shouldn't each count again,
//            but coming back tomorrow should.
//   builds - localStorage. "Someone built one of these", counted once
//            per device, ever. Signed-out people have no other identity,
//            and this is the closest thing to counting a person.
//
// Neither is a defence - a determined caller can hit the RPC directly.
// They keep OUR OWN numbers honest, which is all a client-side guard can
// ever do. Clearing site data starts a device over.
function claimOnce(store: Storage, key: string, slug: string): boolean {
  try {
    const seen = JSON.parse(store.getItem(key) || "[]") as string[];
    if (seen.includes(slug)) return false;
    store.setItem(key, JSON.stringify([...seen, slug]));
    return true;
  } catch {
    // Private mode or a corrupt value. Counting is better than not.
    return true;
  }
}

// Both are fire-and-forget: nothing on the page waits for them and
// nothing changes if they fail. A counter must never break a board.

export async function recordTierListView(slug: string): Promise<void> {
  if (!claimOnce(sessionStorage, "pickem:tier-views", slug)) return;
  const { error } = await supabase.rpc("record_tier_list_view", { p_template: slug });
  if (error) console.warn("View not recorded", error.message);
}

// Called the first time someone actually changes a board - see the
// caller for what counts as a change. No sign-in required, deliberately.
export async function recordTierListBuild(slug: string): Promise<void> {
  if (!claimOnce(localStorage, "pickem:tier-builds", slug)) return;
  const { error } = await supabase.rpc("record_tier_list_build", { p_template: slug });
  if (error) console.warn("Build not recorded", error.message);
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
