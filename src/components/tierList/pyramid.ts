import { Tier, TierListState, tierLabelFor } from "@/lib/tierList";

// The pyramid is a SECOND ARRANGEMENT of a board, not a second board.
//
// Sixteen places in four rows - 1 + 3 + 5 + 7 - and everything else below
// a cut. That shape cannot hold six free-form tiers, so the two are not
// convertible: what the pyramid does instead is fill itself from the
// board's reading order, and refill whenever that order changes. Nothing
// flows back, so switching views never edits the tier list.
export const CAPS = [1, 3, 5, 7] as const;
export const RANKED = CAPS.reduce((a, b) => a + b, 0);

// Where slot n sits: which row, and which place in it.
export const ROW_OF: number[] = CAPS.flatMap((cap, row) => Array<number>(cap).fill(row));
export const FIRST_SLOT_OF: number[] = CAPS.map((_, row) =>
  CAPS.slice(0, row).reduce((a, b) => a + b, 0),
);

// Top tier first, then left to right inside it. It is the only ranking a
// free-form board already contains, so it is what the pyramid fills from.
export const readingOrder = (state: TierListState): string[] =>
  state.tiers.flatMap((t) => state.placements[t.id] ?? []);

export const fillSlots = (order: string[]): (string | null)[] =>
  Array.from({ length: RANKED }, (_, i) => order[i] ?? null);

// The inverse of the fill: which tier and which place in it a given rank
// is, so a move made in the pyramid can be made on the board instead.
//
// This is what makes the pyramid an edit of the tier list rather than a
// picture of it. Slot 5 IS reading position 5, so dropping a team there
// means "make this the sixth-best thing on the board", and the tier it
// lands in falls out of how many the tiers above it already hold.
//
// Computed with the moving item already taken out, because that is the
// order the reducer inserts into - asking where rank 5 is while the item
// is still sitting at rank 2 lands it one place late.
export function insertionForRank(
  state: TierListState,
  itemId: string,
  rank: number,
  hintRow: number,
): { tier: string | null; index: number | null } {
  let at = 0;
  for (const tier of state.tiers) {
    const n = (state.placements[tier.id] ?? []).filter((id) => id !== itemId).length;
    // <= rather than <, so a rank landing exactly on a tier's end appends
    // to that tier instead of jumping to the front of the next one. Both
    // give the same reading order; this one keeps a promotion inside the
    // tier the team was heading for.
    if (rank <= at + n) return { tier: tier.id, index: rank - at };
    at += n;
  }
  // Past the end of every tier - the board has fewer ranked items than
  // the pyramid has places. The row aimed at is the only hint available,
  // and it is a good one: the apex is the top tier.
  const tier = state.tiers[Math.min(hintRow, state.tiers.length - 1)];
  return { tier: tier?.id ?? null, index: null };
}

// The four bands take their look from the board's own top four tiers, so
// the pyramid is recognisably the same list. A board with fewer than four
// tiers still needs four bands, and those fall back to the defaults.
const FALLBACK: { label: string; accent: string }[] = [
  { label: "S", accent: "#f472b6" },
  { label: "A", accent: "#c084fc" },
  { label: "B", accent: "#f87171" },
  { label: "C", accent: "#fb923c" },
];

export function pyramidBands(tiers: Tier[]): { label: string; accent: string }[] {
  return CAPS.map((_, i) => {
    const tier = tiers[i];
    return tier ? { label: tierLabelFor(tier, i), accent: tier.accent } : FALLBACK[i];
  });
}

// ---------------------------------------------------------------- shape
//
// Every proportion is a fraction of the width, so the triangle looks the
// same at any size and only the mark changes.
//
//   T    - the colour band's thickness, measured across the band rather
//          than along the row, so it stays even as the sides close in.
//   apex - the flat width at the top. Not a style choice: it is SOLVED,
//          because the top row is where the triangle is narrowest and it
//          still has to hold the band, a mark, and clear space either
//          side of it. Solving it at the row's mid height - which an
//          earlier version did - is wrong by exactly the amount a mark is
//          tall: the mark reaches up to where the row is narrower still,
//          and the apex mark ended up lying over the band on one side and
//          across the slope on the other.
const CLEAR = 12; // breathing room between the band, the mark and the slope

export function solvePyramid(boardWidth: number) {
  const w = Math.max(240, boardWidth);
  const T = Math.round(w * 0.12);
  // The base row binds the mark size: seven of them plus their gaps have
  // to fit the track the slopes leave at that height.
  const chip = Math.max(20, Math.min(80, Math.floor(w * 0.082)));
  const gap = Math.max(4, Math.round(chip * 0.13));
  const rowH = chip + 24;
  const height = rowH * CAPS.length;

  // How far down the pyramid the top edge of a mark sits, as a fraction.
  // The clear width across any row at that depth is
  //     apex + (w - apex) * t
  // so the smallest apex that still leaves room for band + mark + air is
  // this, and the proportional 0.1375 is only a floor for wide boards.
  const t = (rowH - chip) / 2 / height;
  const need = T + chip + CLEAR * 2;
  const apex = Math.round(Math.max(w * 0.1375, (need - w * t) / (1 - t)));

  // How far in the left edge has come by the time it reaches y.
  const leftEdgeAt = (y: number) => ((w - apex) / 2) * (1 - y / height);
  return { w, T, apex, chip, gap, rowH, height, leftEdgeAt };
}

export type PyramidShape = ReturnType<typeof solvePyramid>;

// Where a slot's mark goes, in the board's own coordinates.
export function slotRect(shape: PyramidShape, slot: number) {
  const row = ROW_OF[slot];
  const place = slot - FIRST_SLOT_OF[row];
  const cap = CAPS[row];
  const span = cap * shape.chip + (cap - 1) * shape.gap;
  const y = row * shape.rowH + (shape.rowH - shape.chip) / 2;
  // Centred on the track the row actually has at the mark's TOP edge,
  // where it is narrowest - a mark is a square, so the row's mid height
  // is not where it can run out of room.
  const edge = shape.leftEdgeAt(y);
  const startX = (edge + shape.T + (shape.w - edge)) / 2 - span / 2;
  return { x: startX + place * (shape.chip + shape.gap), y, size: shape.chip };
}
