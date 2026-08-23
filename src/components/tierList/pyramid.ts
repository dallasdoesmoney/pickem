import { Tier, TierListState, accentForIndex, tierLabelFor } from "@/lib/tierList";

// The pyramid is a SECOND ARRANGEMENT of a board, not a second board.
//
// It has capacity where a tier row has none: a fixed number of places in
// a fixed number of rows, and everything else below a cut. What that
// shape IS, though, is the list's own - saved with it, and edited a row
// at a time.
//
// The silhouette is not drawn, it is DERIVED: each row's width comes from
// how many places it holds, and the outline is threaded through those
// widths. A row wider than the one above slopes out, a narrower one
// slopes back in, and a row holding the same number changes width by
// nothing at all - which is a vertical edge. So the same model draws a
// triangle, a diamond, a kite, an hourglass and a plain stack of equal
// rows, and nobody has to choose between them: you add and remove places
// a row at a time and the shape follows.
export const DEFAULT_CAPS: readonly number[] = [1, 3, 5, 7];

// Ten rows because a band takes its colour and letter from a tier, and a
// board holds ten tiers. Twelve across because past that the logos stop
// being readable on a phone whatever else you do.
export const MAX_PYRAMID_ROWS = 10;
export const MAX_PER_ROW = 12;
// One, to agree with MIN_TIERS: a pyramid row is a tier.
export const MIN_PYRAMID_ROWS = 1;

export const rankedIn = (caps: readonly number[]): number => caps.reduce((a, b) => a + b, 0);

// Where slot n sits: which row, and which place in it.
export const rowsOf = (caps: readonly number[]): number[] =>
  caps.flatMap((cap, row) => Array<number>(cap).fill(row));
export const firstSlotsOf = (caps: readonly number[]): number[] =>
  caps.map((_, row) => caps.slice(0, row).reduce((a, b) => a + b, 0));

// A pyramid ROW IS A TIER. Row r draws tier r, left to right, up to the
// places that row has; anything past that falls below the cut.
//
// It used to be a slice of the whole board's reading order instead -
// every tier flattened into one list and cut at sixteen - and that had
// two consequences nobody wanted. Dropping a team into the fourth row of
// an empty board put it at the APEX, because rank 10 of a board holding
// one team is rank 1; you could only ever fill the thing top to bottom.
// And the tier a team actually landed in was invisible, so the pyramid
// and the tier list disagreed about a board they were both showing.
//
// Tying the row to the tier fixes both at once: every drop says which
// tier, the two layouts always agree, and rows can be filled in any
// order.
export function slotsForBoard(state: TierListState, caps: readonly number[]): (string | null)[] {
  const out: (string | null)[] = [];
  caps.forEach((cap, row) => {
    const tier = state.tiers[row];
    const ids = tier ? state.placements[tier.id] ?? [] : [];
    for (let i = 0; i < cap; i++) out.push(ids[i] ?? null);
  });
  return out;
}

// Everything the shape has no room for: each tier's overflow in tier
// order, then the pool. A team here is not necessarily unranked - it may
// be eleventh in a tier that only shows five - which is why this is
// "missed the cut" rather than "unranked".
export function belowTheCut(state: TierListState, caps: readonly number[]): string[] {
  const out: string[] = [];
  state.tiers.forEach((tier, row) => {
    const ids = state.placements[tier.id] ?? [];
    out.push(...ids.slice(caps[row] ?? 0));
  });
  out.push(...state.unranked);
  return out;
}

// Which tier a slot belongs to, and where in it. The place is where the
// team lands INSIDE that tier - a row compacts left, because a tier is a
// list and a list has no gaps.
export function tierSlotFor(
  state: TierListState,
  caps: readonly number[],
  slot: number,
): { tier: string | null; index: number | null } {
  const row = rowsOf(caps)[slot];
  const place = slot - firstSlotsOf(caps)[row];
  const tier = state.tiers[row];
  return tier ? { tier: tier.id, index: place } : { tier: null, index: null };
}

// The shape has one entry per tier, always. Tiers can be added and
// removed from either layout, so rather than keeping two lengths in step
// everywhere this fits the stored shape to whatever the board has now:
// a new row carries on the way the shape was already going, and rows past
// the last tier are dropped.
export function fitCaps(caps: readonly number[], tierCount: number): number[] {
  const out = caps.slice(0, Math.max(1, tierCount));
  // A row nobody asked for runs STRAIGHT DOWN - it repeats the row above
  // rather than continuing to widen. Carrying the step on instead turned
  // the stock six-tier board into 1-3-5-7-9-11, which is 36 places for 32
  // teams and logos small enough to be unreadable. Widening is something
  // you press the plus for.
  while (out.length < tierCount) out.push(out[out.length - 1] ?? 1);
  return out.map(clampCap);
}

// A band per row, taking its look from the tier at the same depth so the
// pyramid is recognisably the same list. A shape with more rows than the
// board has tiers falls back to the ladder's own colours.
export type PyramidBand = { id: string | null; label: string; accent: string };

export function pyramidBands(tiers: Tier[], caps: readonly number[]): PyramidBand[] {
  return caps.map((_, i) => {
    const tier = tiers[i];
    return tier
      ? { id: tier.id, label: tierLabelFor(tier, i), accent: tier.accent }
      : { id: null, label: "", accent: accentForIndex(i) };
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
// A row is always the same as the row above it, TWO more, or two fewer.
// Never one - because one more team widens a row by one logo plus one
// gap, and two widens it by exactly twice that. Every delta being the
// same size is what holds every sloped edge in the shape at one angle;
// a row that stepped by one would lean at its own angle and the
// silhouette would visibly kink. Same, +2, -2 is the whole vocabulary,
// and a row's minus and plus walk between those three.
export const STEP = 2;

export const clampCap = (n: number) => Math.max(1, Math.min(MAX_PER_ROW, Math.round(n) || 1));

// -1 in, 0 straight down, +1 out. Derived from the counts rather than
// stored, which is lossless because every delta is 0 or +/-STEP.
export type Direction = -1 | 0 | 1;
export const directionsOf = (caps: readonly number[]): Direction[] =>
  caps.map((c, r) => (r === 0 ? 0 : (Math.sign(c - caps[r - 1]) as Direction)));

// Rebuild the counts from the top row and a direction per row. A row that
// cannot go the way it is pointed - there is no room below one, or above
// twelve - goes straight down instead of being clamped part way, because
// a clamped row is a half-step and a half-step is a different angle.
export function capsFromDirs(seed: number, dirs: readonly Direction[]): number[] {
  const caps = [clampCap(seed)];
  for (let r = 1; r < dirs.length; r++) {
    const want = caps[r - 1] + dirs[r] * STEP;
    caps.push(want < 1 || want > MAX_PER_ROW ? caps[r - 1] : want);
  }
  return caps;
}

// Whether a row's minus or plus does anything, so a button with nowhere
// to go greys out instead of looking live and doing nothing.
export function canBump(caps: readonly number[], row: number, by: 1 | -1): boolean {
  if (row === 0) {
    // The top row is the one free number in the shape. It moves by ONE,
    // not two: shifting it shifts every row with it, so every delta -
    // and therefore every angle - is untouched.
    const seed = caps[0] + by;
    return seed >= 1 && seed <= MAX_PER_ROW;
  }
  const dirs = directionsOf(caps);
  const next = dirs[row] + by;
  if (next < -1 || next > 1) return false;
  const want = caps[row - 1] + next * STEP;
  return want >= 1 && want <= MAX_PER_ROW;
}

export function bumpRow(caps: readonly number[], row: number, by: 1 | -1): number[] {
  if (!canBump(caps, row, by)) return [...caps];
  const dirs = directionsOf(caps);
  if (row === 0) return capsFromDirs(caps[0] + by, dirs);
  dirs[row] = (dirs[row] + by) as Direction;
  return capsFromDirs(caps[0], dirs);
}

export function addRow(caps: readonly number[]): number[] {
  if (caps.length >= MAX_PYRAMID_ROWS) return [...caps];
  const dirs = directionsOf(caps);
  // Carries on the way the shape was already going, so adding a row to a
  // triangle keeps it a triangle rather than putting a kink in it.
  return capsFromDirs(caps[0], [...dirs, dirs[dirs.length - 1] || 1]);
}

export function removeRow(caps: readonly number[]): number[] {
  return caps.length > MIN_PYRAMID_ROWS ? caps.slice(0, -1) : [...caps];
}

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
