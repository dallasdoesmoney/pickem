import { Tier, TierListState, accentForIndex, tierLabelFor } from "@/lib/tierList";

// The pyramid is a SECOND ARRANGEMENT of a board, not a second board.
//
// It has capacity where a tier row has none: a fixed number of places in
// a fixed number of rows, and everything else below a cut. What that
// shape IS, though, is the list's own - saved with it, and edited a row
// at a time.
//
// A row can hold more than the row above it, the same, or fewer, and
// nothing else. That single rule is what keeps the silhouette honest:
// adding one team widens a row by exactly one logo plus one gap, so a
// constant step is a constant rise over a constant run, and every edge in
// the shape lands on the same angle. A row that holds the SAME number
// changes width by nothing at all, and no width change is a vertical
// edge. Out, straight down, in - there is no fourth thing an edge can do.
//
// So the same model draws a triangle, a diamond, a kite, an hourglass and
// a plain stack of equal rows, and all of them are made of one angle and
// ninety degrees.
export const DEFAULT_CAPS: readonly number[] = [1, 3, 5, 7];

// Ten rows because a band takes its colour and letter from a tier, and a
// board holds ten tiers. Twelve across because past that the logos stop
// being readable on a phone whatever else you do.
export const MAX_PYRAMID_ROWS = 10;
export const MAX_PER_ROW = 12;
export const MIN_PYRAMID_ROWS = 2;

// How many teams a row gains or loses from the one above. This is the
// angle: bigger steps lean the sides over further. Two is what the board
// has always used, which is why its sides sit near 56 degrees.
export const STEP_CHOICES = [1, 2, 3] as const;
export const DEFAULT_STEP = 2;

export const rankedIn = (caps: readonly number[]): number => caps.reduce((a, b) => a + b, 0);

// Where slot n sits: which row, and which place in it.
export const rowsOf = (caps: readonly number[]): number[] =>
  caps.flatMap((cap, row) => Array<number>(cap).fill(row));
export const firstSlotsOf = (caps: readonly number[]): number[] =>
  caps.map((_, row) => caps.slice(0, row).reduce((a, b) => a + b, 0));

// Top tier first, then left to right inside it. It is the only ranking a
// free-form board already contains, so it is what the pyramid fills from.
export const readingOrder = (state: TierListState): string[] =>
  state.tiers.flatMap((t) => state.placements[t.id] ?? []);

export const fillSlots = (order: string[], caps: readonly number[]): (string | null)[] =>
  Array.from({ length: rankedIn(caps) }, (_, i) => order[i] ?? null);

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

// A band per row, taking its look from the tier at the same depth so the
// pyramid is recognisably the same list. A shape with more rows than the
// board has tiers falls back to the ladder's own colours.
export function pyramidBands(
  tiers: Tier[],
  caps: readonly number[],
): { label: string; accent: string }[] {
  return caps.map((_, i) => {
    const tier = tiers[i];
    return tier
      ? { label: tierLabelFor(tier, i), accent: tier.accent }
      : { label: "", accent: accentForIndex(i) };
  });
}

// ---------------------------------------------------------------- shape
//
// Every proportion is a fraction of the width, so the triangle looks the
// same at any size and only the mark changes.
//
//   T     - the colour band's thickness, measured across the band rather
//           than along the row, so it stays even as the sides close in.
//   verts - the silhouette, as the width the shape has at a series of
//           heights. Seams always, PLUS the mid-height of any row that
//           turns from out to in. Half way down the turning row is the
//           only place a corner can sit and still leave that row's teams
//           the same room above and below it, and it is what gives a
//           diamond a real point instead of a flat shoulder.
const CLEAR = 12; // breathing room between the band, the mark and the slope
const MIN_WIDTH = 30;
const FIT_SAMPLES = 8;

// A row's own height. Proportional, NOT chip + 24, because the angle is
// rise over run: the run scales with the logo and a fixed padding does
// not, so a constant 24 makes the sides steeper on a phone than on a
// desktop. 1.667 is exactly chip + 24 at the size a desktop board
// already solves, so nothing visibly moves; it just stops drifting. The
// clamp keeps very small boards from getting cramped.
const rowHeightFor = (chip: number) =>
  Math.round(Math.max(chip + 16, Math.min(chip + 34, chip * 1.667)));

export type PyramidShape = {
  w: number;
  T: number;
  chip: number;
  gap: number;
  rowH: number;
  height: number;
  caps: readonly number[];
  verts: { y: number; width: number }[];
  leftEdgeAt: (y: number) => number;
  widthAt: (y: number) => number;
  centre: number;
};

function vertsFor(need: number[], rowH: number): { y: number; width: number }[] {
  const n = need.length;
  // The width each row's own edge adds. A row continues what brought it
  // there through its top half and anticipates what comes next through
  // its bottom half, so a row whose two halves disagree is the one that
  // gets the corner.
  const delta = (r: number) => (r <= 0 ? 0 : need[r] - need[r - 1]);
  const din = (r: number) => (r === 0 ? delta(1) : delta(r));
  const dout = (r: number) => (r === n - 1 ? din(r) : delta(r + 1));

  const out: { y: number; width: number }[] = [{ y: 0, width: 0 }];
  let w = 0;
  for (let r = 0; r < n; r++) {
    const a = din(r);
    const b = dout(r);
    if (a !== b) {
      w += a / 2;
      out.push({ y: r * rowH + rowH / 2, width: w });
      w += b / 2;
    } else {
      w += a;
    }
    out.push({ y: (r + 1) * rowH, width: w });
  }
  return out;
}

export function solvePyramid(boardWidth: number, caps: readonly number[]): PyramidShape {
  const rows = Math.max(1, caps.length);
  const bw = Math.max(240, boardWidth);
  const T = Math.round(bw * 0.12);
  const first = Math.max(20, Math.min(80, Math.floor(bw * 0.082)));

  for (let chip = first; chip >= 14; chip--) {
    const gap = Math.max(4, Math.round(chip * 0.13));
    const rowH = rowHeightFor(chip);
    const height = rowH * rows;
    const m = (rowH - chip) / 2;
    // What each row asks for: band, air, its teams, their gaps, air.
    const need = caps.map((c) => T + CLEAR * 2 + c * chip + (c - 1) * gap);

    const raw = vertsFor(need, rowH);
    const read = (v: { y: number; width: number }[], y: number) => {
      const p = Math.max(0, Math.min(height, y));
      for (let i = 0; i < v.length - 1; i++) {
        if (p >= v[i].y - 1e-6 && p <= v[i + 1].y + 1e-6) {
          const span = v[i + 1].y - v[i].y || 1;
          return v[i].width + (v[i + 1].width - v[i].width) * ((p - v[i].y) / span);
        }
      }
      return v[v.length - 1].width;
    };

    // One shared nudge outward, never a per-row one: shifting the whole
    // silhouette by a single number keeps every straight run straight. A
    // square logo is widest at its corners, and on a row that turns the
    // narrowest point is neither corner, so this samples the mark's whole
    // height rather than reasoning about its ends.
    let lift = 0;
    for (let r = 0; r < rows; r++) {
      let min = Infinity;
      for (let s = 0; s <= FIT_SAMPLES; s++) {
        min = Math.min(min, read(raw, r * rowH + m + (chip * s) / FIT_SAMPLES));
      }
      lift = Math.max(lift, need[r] - min);
    }
    const verts = raw.map((v) => ({ y: v.y, width: Math.max(MIN_WIDTH, v.width + lift) }));

    const w = Math.max(...verts.map((v) => v.width));
    if (w > bw + 0.5 && chip > 14) continue;

    const widthAt = (y: number) => read(verts, y);
    return {
      w,
      T,
      chip,
      gap,
      rowH,
      height,
      caps,
      verts,
      widthAt,
      leftEdgeAt: (y: number) => (w - widthAt(y)) / 2,
      // Both slopes are symmetric about the middle, so the usable track's
      // centre is (w + T) / 2 at EVERY height - a mark never needs to
      // know how far in the sides have come.
      centre: (w + T) / 2,
    };
  }
  // Unreachable: the loop returns at chip 14 whatever the width.
  throw new Error("no pyramid fits");
}

// Where a slot's mark goes, in the board's own coordinates.
export function slotRect(shape: PyramidShape, slot: number) {
  const rows = rowsOf(shape.caps);
  const firsts = firstSlotsOf(shape.caps);
  const row = rows[slot];
  const place = slot - firsts[row];
  const cap = shape.caps[row];
  const span = cap * shape.chip + (cap - 1) * shape.gap;
  return {
    x: shape.centre - span / 2 + place * (shape.chip + shape.gap),
    y: row * shape.rowH + (shape.rowH - shape.chip) / 2,
    size: shape.chip,
  };
}

// A row's silhouette and its band, as clip-paths in the row's own box.
//
// ALWAYS six points, even when four would draw the same thing. A row that
// turns genuinely needs the mid-height pair, and clip-path only
// interpolates between polygons with matching point counts - so a
// four-point row would snap rather than animate the moment the shape
// beside it had a corner. The middle pair simply sits on the line when
// there is no corner to describe.
export function rowClip(shape: PyramidShape, row: number): { row: string; band: string } {
  const top = row * shape.rowH;
  const mid = top + shape.rowH / 2;
  const bottom = top + shape.rowH;
  const ys = [top, mid, bottom];
  const pct = (y: number) => ((y - top) / shape.rowH) * 100;
  const L = (y: number) => shape.leftEdgeAt(y);

  const outer: string[] = [];
  const band: string[] = [];
  for (const y of ys) {
    outer.push(`${shape.w - L(y)}px ${pct(y)}%`);
    band.push(`${L(y) + shape.T}px ${pct(y)}%`);
  }
  for (let i = ys.length - 1; i >= 0; i--) {
    outer.push(`${L(ys[i])}px ${pct(ys[i])}%`);
    band.push(`${L(ys[i])}px ${pct(ys[i])}%`);
  }
  return { row: `polygon(${outer.join(", ")})`, band: `polygon(${band.join(", ")})` };
}

// The outline, as one polygon: down the right through every vertex, then
// back up the left.
export function silhouettePoints(shape: PyramidShape): string {
  const pts: string[] = [];
  for (const v of shape.verts) pts.push(`${(shape.w + v.width) / 2},${v.y}`);
  for (let i = shape.verts.length - 1; i >= 0; i--) {
    pts.push(`${(shape.w - shape.verts[i].width) / 2},${shape.verts[i].y}`);
  }
  return pts.join(" ");
}

// ------------------------------------------------------------- editing
//
// A shape is edited a row at a time, and a row only ever holds more than
// the one above it, the same, or fewer. These keep that true: the counts
// are never set directly, they are derived from the top row and a
// direction per row, so a half-step - which would be a different angle -
// cannot be expressed at all.
export type Direction = -1 | 0 | 1;

export const stepOf = (caps: readonly number[]): number => {
  for (let r = 1; r < caps.length; r++) {
    const d = Math.abs(caps[r] - caps[r - 1]);
    if (d) return d;
  }
  return DEFAULT_STEP; // every row the same width; the step is moot
};

export const directionsOf = (caps: readonly number[]): Direction[] => {
  const d = caps.map((c, r) => (r === 0 ? 0 : (Math.sign(c - caps[r - 1]) as Direction)));
  d[0] = d[1] ?? 1;
  return d;
};

export function capsFrom(seed: number, dirs: readonly Direction[], step: number): number[] {
  const caps = [clampCap(seed)];
  for (let r = 1; r < dirs.length; r++) {
    // Turned around rather than clamped. A clamped row would be a
    // half-step, and a half-step is a different angle - the one thing
    // this model exists to rule out.
    const want = caps[r - 1] + dirs[r] * step;
    caps.push(want < 1 || want > MAX_PER_ROW ? caps[r - 1] : want);
  }
  return caps;
}

export const clampCap = (n: number) => Math.max(1, Math.min(MAX_PER_ROW, Math.round(n) || 1));

// Whether a row could go that way at all, so a direction with no room
// greys out rather than letting someone build something crooked.
export const canGo = (above: number, dir: Direction, step: number) => {
  const want = above + dir * step;
  return want >= 1 && want <= MAX_PER_ROW;
};

// Anything that crossed a trust boundary - a hand-edited localStorage
// blob, an old saved row, a share snapshot.
export function sanitizeCaps(raw: unknown): number[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const caps = raw
    .slice(0, MAX_PYRAMID_ROWS)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n))
    .map(clampCap);
  return caps.length >= MIN_PYRAMID_ROWS ? caps : null;
}
