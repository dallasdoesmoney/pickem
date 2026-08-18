import { TierTemplate } from "@/data/tierTemplates";

// Tier identity is a generated id, never the label - users rename "S" to
// "Elite" and every placement has to survive that. Labels are display
// only; `accent` is carried now (and round-trips through save/share) so
// user-picked tier colors can be switched on later without a migration.
export type Tier = {
  id: string;
  label: string;
  accent: string;
};

// The whole serializable unit: what goes to localStorage, to Supabase, and
// into a share snapshot. Placements are keyed by tier id and ordered, so
// nothing depends on array position of the tiers themselves.
export type TierListState = {
  template: string;
  title: string;
  tiers: Tier[];
  placements: Record<string, string[]>;
  unranked: string[];
};

export const MAX_TIERS = 10;
export const MIN_TIERS = 1;
export const MAX_TIER_LABEL = 14;
export const MAX_TITLE = 60;

// Gold (best) down to red (worst). Deliberately reuses the app's existing
// win-green / loss-red vocabulary at the ends rather than the usual
// tiermaker rainbow, where green-at-the-bottom would read as "good" here.
const DEFAULT_TIER_SPEC: [label: string, accent: string][] = [
  ["S", "#fbbf24"],
  ["A", "#4ade80"],
  ["B", "#38bdf8"],
  ["C", "#a78bfa"],
  ["D", "#fb923c"],
  ["F", "#f87171"],
];

// Counter-based rather than crypto.randomUUID(): ids only need to be
// unique within one list, and a deterministic sequence keeps SSR and the
// first client render identical (randomUUID in a reducer initializer is a
// classic hydration mismatch).
let tierSeq = 0;
export function newTierId() {
  tierSeq += 1;
  return `t${Date.now().toString(36)}${tierSeq.toString(36)}`;
}

export function createInitialState(template: TierTemplate): TierListState {
  const tiers = DEFAULT_TIER_SPEC.map(([label, accent], i) => ({ id: `t_${i}_${label.toLowerCase()}`, label, accent }));
  const placements: Record<string, string[]> = {};
  for (const t of tiers) placements[t.id] = [];
  return {
    template: template.slug,
    title: template.defaultListTitle,
    tiers,
    placements,
    unranked: template.items.map((i) => i.id),
  };
}

export type TierListAction =
  // toTier null === back to the unranked pool. toIndex null === append.
  // mergeToken groups the flurry of moves a single drag produces (one per
  // dragOver, plus the final drop) into one undo step - without it,
  // undoing a drag would rewind it one hover at a time.
  | { type: "moveItem"; itemId: string; toTier: string | null; toIndex: number | null; mergeToken?: string }
  | { type: "renameTier"; tierId: string; label: string }
  | { type: "addTier"; afterTierId?: string }
  | { type: "deleteTier"; tierId: string }
  | { type: "moveTier"; tierId: string; direction: -1 | 1 }
  | { type: "setTitle"; title: string }
  | { type: "shuffleUnranked" }
  | { type: "reset"; template: TierTemplate }
  | { type: "load"; state: TierListState };

// Pull an item out of wherever it currently lives. Returns a new
// placements/unranked pair so the reducer stays pure.
function removeItem(state: TierListState, itemId: string) {
  const placements: Record<string, string[]> = {};
  for (const [tierId, ids] of Object.entries(state.placements)) {
    placements[tierId] = ids.filter((id) => id !== itemId);
  }
  return { placements, unranked: state.unranked.filter((id) => id !== itemId) };
}

function insertAt(list: string[], itemId: string, index: number | null) {
  const next = [...list];
  if (index === null || index < 0 || index > next.length) next.push(itemId);
  else next.splice(index, 0, itemId);
  return next;
}

export function tierListReducer(state: TierListState, action: TierListAction): TierListState {
  switch (action.type) {
    case "moveItem": {
      const { itemId, toTier, toIndex } = action;
      // Guard against a stale drop onto a tier that was deleted mid-drag.
      if (toTier !== null && !state.tiers.some((t) => t.id === toTier)) return state;
      const stripped = removeItem(state, itemId);
      if (toTier === null) {
        return { ...state, placements: stripped.placements, unranked: insertAt(stripped.unranked, itemId, toIndex) };
      }
      return {
        ...state,
        unranked: stripped.unranked,
        placements: { ...stripped.placements, [toTier]: insertAt(stripped.placements[toTier] ?? [], itemId, toIndex) },
      };
    }

    case "renameTier": {
      // Trim and clamp here rather than in the input handler so every
      // caller (including a pasted 400-char string) gets the same rule.
      const label = action.label.slice(0, MAX_TIER_LABEL);
      return { ...state, tiers: state.tiers.map((t) => (t.id === action.tierId ? { ...t, label } : t)) };
    }

    case "addTier": {
      if (state.tiers.length >= MAX_TIERS) return state;
      const id = newTierId();
      const accent = DEFAULT_TIER_SPEC[state.tiers.length % DEFAULT_TIER_SPEC.length][1];
      const tier: Tier = { id, label: "NEW", accent };
      const at = action.afterTierId ? state.tiers.findIndex((t) => t.id === action.afterTierId) : -1;
      const tiers = [...state.tiers];
      if (at >= 0) tiers.splice(at + 1, 0, tier);
      else tiers.push(tier);
      return { ...state, tiers, placements: { ...state.placements, [id]: [] } };
    }

    case "deleteTier": {
      if (state.tiers.length <= MIN_TIERS) return state;
      const doomed = state.placements[action.tierId] ?? [];
      const placements = { ...state.placements };
      delete placements[action.tierId];
      return {
        ...state,
        tiers: state.tiers.filter((t) => t.id !== action.tierId),
        placements,
        // Never silently drop items - they go back to the pool.
        unranked: [...state.unranked, ...doomed],
      };
    }

    case "moveTier": {
      const from = state.tiers.findIndex((t) => t.id === action.tierId);
      if (from < 0) return state;
      const to = from + action.direction;
      if (to < 0 || to >= state.tiers.length) return state;
      const tiers = [...state.tiers];
      const [moved] = tiers.splice(from, 1);
      tiers.splice(to, 0, moved);
      return { ...state, tiers };
    }

    case "setTitle":
      return { ...state, title: action.title.slice(0, MAX_TITLE) };

    case "shuffleUnranked": {
      // Fisher-Yates. Only touches the pool; ranked items are untouched.
      const next = [...state.unranked];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
      return { ...state, unranked: next };
    }

    case "reset":
      return createInitialState(action.template);

    case "load":
      return action.state;
  }
}

export function rankedCount(state: TierListState): number {
  return Object.values(state.placements).reduce((n, ids) => n + ids.length, 0);
}

export function findItemTier(state: TierListState, itemId: string): string | null {
  for (const [tierId, ids] of Object.entries(state.placements)) {
    if (ids.includes(itemId)) return tierId;
  }
  return null;
}

// Labels are user-editable and may be blank while being typed. Anywhere a
// label is *displayed* (tier rail, share image) goes through this so an
// empty tier still has a grabbable, readable marker.
export function tierLabelFor(tier: Tier, index: number): string {
  const trimmed = tier.label.trim();
  return trimmed || `TIER ${index + 1}`;
}

// Defensive rehydration for anything that crossed a trust boundary:
// localStorage a user could have hand-edited, an old saved row whose
// template has since changed, or a share snapshot. Rebuilds against the
// live template so unknown ids are dropped and newly-added items show up
// in the pool instead of vanishing.
export function sanitizeState(raw: unknown, template: TierTemplate): TierListState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<TierListState>;
  if (!Array.isArray(r.tiers) || !r.tiers.length) return null;

  const valid = new Set(template.items.map((i) => i.id));
  const seen = new Set<string>();

  const tiers: Tier[] = [];
  for (const t of r.tiers.slice(0, MAX_TIERS)) {
    if (!t || typeof t.id !== "string" || !t.id) continue;
    if (tiers.some((x) => x.id === t.id)) continue;
    tiers.push({
      id: t.id,
      label: typeof t.label === "string" ? t.label.slice(0, MAX_TIER_LABEL) : "",
      accent: typeof t.accent === "string" && /^#[0-9a-f]{6}$/i.test(t.accent) ? t.accent : "#94a3b8",
    });
  }
  if (!tiers.length) return null;

  const placements: Record<string, string[]> = {};
  for (const t of tiers) {
    const ids = Array.isArray(r.placements?.[t.id]) ? r.placements[t.id] : [];
    // An item can only live in one place; first occurrence wins.
    placements[t.id] = ids.filter((id) => typeof id === "string" && valid.has(id) && !seen.has(id) && seen.add(id));
  }

  const rawUnranked = Array.isArray(r.unranked) ? r.unranked : [];
  const unranked = rawUnranked.filter((id) => typeof id === "string" && valid.has(id) && !seen.has(id) && seen.add(id));
  // Items the snapshot never mentioned (template grew, or corrupt data).
  for (const item of template.items) if (!seen.has(item.id)) unranked.push(item.id);

  return {
    template: template.slug,
    title: typeof r.title === "string" && r.title.trim() ? r.title.slice(0, MAX_TITLE) : template.defaultListTitle,
    tiers,
    placements,
    unranked,
  };
}
