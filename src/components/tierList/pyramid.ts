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
//   apex - the flat width at the top. Not a style choice: a band thick
//          enough to carry its own name needs T + mark + padding of clear
//          width at the top row's mid height, and that height is only an
//          eighth of the base.
export function solvePyramid(boardWidth: number) {
  const w = Math.max(240, boardWidth);
  const T = Math.round(w * 0.12);
  const apex = Math.round(w * 0.1375);
  // The base row binds: seven marks between the band and the right-hand
  // slope, where the slope has already taken 0.108w per side.
  const chip = Math.max(20, Math.min(80, Math.floor(w * 0.082)));
  const gap = Math.max(4, Math.round(chip * 0.13));
  const rowH = chip + 24;
  const height = rowH * CAPS.length;
  // How far in the left edge has come by the time it reaches Y.
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
  // Centred on the track that is left once the band has taken its share,
  // which is what keeps the marks inside the slopes on every row.
  const startX = (shape.w + shape.T) / 2 - span / 2;
  return {
    x: startX + place * (shape.chip + shape.gap),
    y: row * shape.rowH + (shape.rowH - shape.chip) / 2,
    size: shape.chip,
  };
}
