import { PyramidShape } from "./pyramid";

// Switching layouts, as one movement.
//
// The two layouts are different element trees, so nothing morphs from one
// into the other on its own. Every part of this is therefore the same
// trick: read where a thing is, switch, read where it now is, and play it
// from the old place to the new.
//
// The whole point is that both ends are MEASURED. An earlier version had
// the pyramid fold itself in on mount, from its own idea of full width -
// which is not where the tier rows had just been, because a tier row is
// taller than a pyramid row and sits at a different height. Every band
// jumped before it folded, and that jump is what read as a snag.
//
// The Web Animations API rather than inline styles, because a re-render
// mid-flight would overwrite a style and snap the board.

export const CASCADE_MS = 720;
export const CASCADE_EASE = "cubic-bezier(.65,0,.35,1)";
const ROW_STAGGER = 80;

// Bottom row first: the base settles and the rows fold in above it, which
// reads as the board folding itself rather than a control being flipped.
// Takes the row count from the shape now that a board's shape is its own -
// a three-row diamond staggers over three rows, not four.
const delayFor = (row: number, rows: number) =>
  Math.max(0, Math.min(rows - 1, rows - 1 - Math.floor(row))) * ROW_STAGGER;

type RowGeom = { top: number; height: number; railW: number };

export type BoardSnapshot = {
  height: number;
  marks: Map<string, DOMRect>;
  rows: RowGeom[];
  boardTop: number;
};

// One layout pass for the whole board: every read happens here, and every
// write happens after. Interleaving them is what makes a board of
// thirty-two marks stutter.
export function readBoard(board: HTMLElement, view: "rows" | "pyramid", shape: PyramidShape): BoardSnapshot {
  const boardTop = board.getBoundingClientRect().top;
  const marks = new Map<string, DOMRect>();
  board.querySelectorAll<HTMLElement>("[data-mark]").forEach((el) => {
    marks.set(el.dataset.mark!, el.getBoundingClientRect());
  });

  const rows: RowGeom[] = [];
  const sel = view === "rows" ? "[data-tier-row]" : "[data-prow]";
  board.querySelectorAll<HTMLElement>(sel).forEach((el) => {
    const r = el.getBoundingClientRect();
    // The pyramid's band is a clipped overlay the width of the whole row,
    // so its own rect says nothing; its thickness is the shape's.
    const rail = el.querySelector<HTMLElement>("[data-tier-rail]");
    rows.push({
      top: r.top - boardTop,
      height: r.height,
      railW: view === "rows" ? (rail?.getBoundingClientRect().width ?? 0) : shape.T,
    });
  });

  return { height: board.offsetHeight, marks, rows, boardTop };
}

// SIX points, not four, with a redundant pair at the mid height. A
// pyramid row is six points now - a row that turns needs the mid pair to
// describe its corner - and clip-path only interpolates between polygons
// with matching point counts. A four-point rectangle at one end of the
// animation would snap rather than fold.
const rect = (w: number, top: number, bottom: number) => {
  const mid = (top + bottom) / 2;
  return `polygon(${w}px ${top}px, ${w}px ${mid}px, ${w}px ${bottom}px, ` +
    `0px ${bottom}px, 0px ${mid}px, 0px ${top}px)`;
};

// The band's rectangle, in the same six points.
const railRect = (railW: number, top: number, bottom: number) => rect(railW, top, bottom);

export function runCascade(
  board: HTMLElement,
  next: "rows" | "pyramid",
  shape: PyramidShape,
  before: BoardSnapshot,
) {
  const after = readBoard(board, next, shape);
  const rows = shape.caps.length;
  const play = (el: Element, frames: Keyframe[], delay: number, extra?: KeyframeAnimationOptions) =>
    el.animate(frames, { duration: CASCADE_MS, delay, easing: CASCADE_EASE, fill: "backwards", ...extra });

  // ---- the marks, carried across by id ----
  after.marks.forEach((to, id) => {
    const from = before.marks.get(id);
    if (!from) return;
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    const scale = to.width ? from.width / to.width : 1;
    if (!dx && !dy && Math.abs(scale - 1) < 0.01) return;
    const el = board.querySelector<HTMLElement>(`[data-mark="${CSS.escape(id)}"]`);
    if (!el) return;
    const band = ((next === "pyramid" ? to.top : from.top) - after.boardTop) / shape.rowH;
    play(
      el,
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
        { transform: "translate(0px, 0px) scale(1)" },
      ],
      delayFor(band, rows),
      // Added to whatever transform the element already carries, so a
      // chip that dnd-kit or a hover is already moving is not fought.
      { composite: "add" },
    );
  });

  // ---- the bands ----
  //
  // Going INTO the pyramid the rows are absolutely positioned, so they
  // can be animated from the exact top and height the tier rows had.
  // Coming BACK they are flow items and cannot, so the same movement is
  // expressed as a clip that opens from the band's rectangle to the whole
  // row - the visible result is identical, and neither one reflows.
  if (next === "pyramid") {
    board.querySelectorAll<HTMLElement>("[data-prow]").forEach((el, i) => {
      const was = before.rows[i];
      if (!was) return;
      const w = el.offsetWidth;
      const now = getComputedStyle(el);
      play(
        el,
        [
          { top: `${was.top}px`, height: `${was.height}px`, clipPath: rect(w, 0, was.height) },
          { top: now.top, height: now.height, clipPath: now.clipPath },
        ],
        delayFor(i, rows),
      );
      const bandEl = el.querySelector<HTMLElement>("[data-pband]");
      if (bandEl) {
        const bs = getComputedStyle(bandEl);
        play(
          bandEl,
          [{ clipPath: railRect(was.railW, 0, was.height) }, { clipPath: bs.clipPath }],
          delayFor(i, rows),
        );
      }
      const labelEl = el.querySelector<HTMLElement>("[data-plabel]");
      if (labelEl) {
        const ls = getComputedStyle(labelEl);
        play(
          labelEl,
          [
            { transform: `translate(${was.railW / 2}px, -50%) translateX(-50%)` },
            { transform: ls.transform },
          ],
          delayFor(i, rows),
        );
      }
    });
    // The silhouette cannot fold with them - SVG points are not
    // animatable - and drawn at its final shape from the first frame it
    // reads as two diagonals slashing across a board that is still
    // square. So it arrives once the shape it outlines has formed.
    const edge = board.querySelector("[data-pedge]");
    if (edge) {
      play(edge, [{ opacity: 0 }, { opacity: 0 }, { opacity: 1 }], 0, {
        duration: CASCADE_MS + ROW_STAGGER * (rows - 1) + 120,
      });
    }
  } else {
    board.querySelectorAll<HTMLElement>("[data-tier-row]").forEach((el, i) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      if (i >= rows) {
        // A tier the pyramid had no room for. It was not on screen at all
        // a moment ago, so it arrives rather than moves.
        play(el, [{ opacity: 0 }, { opacity: 1 }], delayFor(0, rows) + 60);
        return;
      }
      const bandTop = i * shape.rowH;
      const a = shape.leftEdgeAt(bandTop);
      const b = shape.leftEdgeAt(bandTop + shape.rowH);
      const m = shape.leftEdgeAt(bandTop + shape.rowH / 2);
      // Where the band sat inside this row's own box. The two have
      // different heights, so this is the band's shape expressed in the
      // row's coordinates rather than the row's own top and bottom - and
      // in the same six points the pyramid row itself uses, mid height
      // included, so a diamond's corner unfolds instead of snapping.
      const from = Math.max(0, Math.min(h, bandTop - (after.rows[i]?.top ?? 0)));
      const to = Math.min(h, from + shape.rowH);
      const half = (from + to) / 2;
      const wedge =
        `polygon(${w - a}px ${from}px, ${w - m}px ${half}px, ${w - b}px ${to}px, ` +
        `${b}px ${to}px, ${m}px ${half}px, ${a}px ${from}px)`;
      play(el, [{ clipPath: wedge }, { clipPath: rect(w, 0, h) }], delayFor(i, rows));
      // The rail rides in from where its band was sitting on the slope, so
      // the colour arrives with the row rather than being revealed by it.
      const rail = el.querySelector<HTMLElement>("[data-tier-rail]");
      if (rail) {
        play(rail, [{ transform: `translateX(${(a + b) / 2}px)` }, { transform: "translateX(0px)" }], delayFor(i, rows));
      }
    });
  }

  // ---- the board's own height ----
  //
  // The two layouts are very different heights. Without this everything
  // below - the controls, share, save - jumps the instant you press the
  // toggle, which is most of what read as a snag.
  if (Math.abs(after.height - before.height) > 4) {
    play(board, [{ height: `${before.height}px` }, { height: `${after.height}px` }], 0, {
      duration: CASCADE_MS + 80,
    });
  }
}
