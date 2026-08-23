import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { TierListState, tierLabelFor } from "@/lib/tierList";
import { BRAND_LOGO_SRC, drawBrandFooter, loadImage, resolveDisplayFont, roundRectPath } from "@/lib/canvasShare";
import { BACKDROP_OPACITY, BACKDROP_SCALE } from "@/components/tierList/TierItemChip";
import {
  DEFAULT_CAPS,
  PyramidShape,
  pyramidBands,
  fitCaps,
  rankedIn,
  sanitizeCaps,
  slotRect,
  solvePyramid,
} from "@/components/tierList/pyramid";

// Same canvas approach and the same 840px width as the picks/predictor
// share cards, so all three read as one family in a feed. Purpose-built
// for export rather than a screenshot of the DOM: the on-screen list is
// a scrolling, viewport-dependent, interactive thing, and none of that
// survives being flattened to an image.
const WIDTH = 840;
const PAD_X = 40;
const PAD_TOP = 36;
const PAD_BOTTOM = 40;
const BG = "#0e1b33";

const HEADER_EYEBROW_PX = 15;
const HEADER_EYEBROW_GAP = 14;
const HEADER_TITLE_PX = 44;
const HEADER_TITLE_GAP = 10;

const RAIL_W = 118;
// Rows butt straight into each other now - the board is one block.
const ROW_GAP = 0;
// 2 rather than 1: this card renders at 2x and is looked at scaled down
// in a feed, where a single device pixel disappears.
const ROW_LINE = 2;

// The rail's face. The board sets its tier names in the body face at 600
// - the display face is a poster face and at this size it turned a name
// into a slab you read letter by letter - so the card does the same.
const railFont = (px: number) => `600 ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
const ROW_PAD = 10;
const CHIP_GAP = 6;
const ROW_RADIUS = 18;

const BRAND_FOOTER_H = 12 + 104 + 10 + 18 + 10;

export type TierShareParams = {
  state: TierListState;
  template: TierTemplate;
  // The pyramid's sixteen places, when the board is showing the pyramid.
  // Absent means the card renders the tier list, which is the default and
  // what every caller outside the editor wants.
  pyramid?: (string | null)[] | null;
};

// Fixed rather than solved from the widest row. Solving meant a tier
// holding 20 teams squeezed all 20 onto one line and every other tier
// inherited those tiny logos - the exported image looked nothing like the
// page it came from. A constant mark size with long tiers wrapping is the
// behaviour that reads as "the list you built".
//
// These deliberately do NOT track the live board's column count. The board
// is responsive (5/7/8/10 across depending on viewport) and the card is one
// fixed 840px composition, so it can only ever match one viewport; it is
// held at 840 to stay the same width as the picks and predictor cards, so
// all three read as one family in a feed. Widening it to carry the desktop
// board's ten columns at this chip size would take ~992px and break that.
// Consequence to know about: a tier of ten sits on one line on a desktop
// board and wraps to two here.
const CHIP = 72;
const PER_ROW = 8;

function rowHeight(count: number, chip: number, perRow: number): number {
  const lines = Math.max(1, Math.ceil(count / perRow));
  return ROW_PAD * 2 + lines * chip + (lines - 1) * CHIP_GAP;
}

export async function renderTierShareImage({ state, template, pyramid }: TierShareParams): Promise<Blob> {
  const displayFont = resolveDisplayFont();
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.load(`16px ${displayFont}`);
      await document.fonts.ready;
    } catch {
      // fall through with whatever font is available
    }
  }

  const chip = CHIP;
  const perRow = PER_ROW;

  // Unranked teams are shown as a final muted strip rather than being
  // dropped - a half-finished list is still a statement - but only when
  // some exist, so a completed list ends cleanly on its last tier.
  const showUnranked = state.unranked.length > 0;

  const rows = state.tiers.map((t) => ({ tier: t, ids: state.placements[t.id] ?? [] }));

  // Pyramid mode is a different composition, not a variant of the rows:
  // its own geometry, its own mark size, and a cut instead of an unranked
  // strip. Everything below branches on it once and then goes its own way.
  // Same guard as the editor: a share snapshot is the least trustworthy
  // state in the app.
  const caps = fitCaps(sanitizeCaps(state.pyramid) ?? [...DEFAULT_CAPS], state.tiers.length);
  const shape = pyramid ? solvePyramid(WIDTH - PAD_X * 2, caps) : null;
  const placed = new Set((pyramid ?? []).filter(Boolean) as string[]);
  const missed = pyramid ? template.items.map((i) => i.id).filter((id) => !placed.has(id)) : [];

  const bodyH = shape
    ? shape.height + 26 + rowHeight(missed.length, shape.chip, PER_ROW) + ROW_GAP
    : rows.reduce((h, r) => h + rowHeight(r.ids.length, chip, perRow) + ROW_GAP, 0) +
      (showUnranked ? rowHeight(state.unranked.length, chip, perRow) + ROW_GAP + 26 : 0);

  const headerH = HEADER_EYEBROW_PX + HEADER_EYEBROW_GAP + HEADER_TITLE_PX + HEADER_TITLE_GAP + 20;
  const totalHeight = PAD_TOP + headerH + bodyH + BRAND_FOOTER_H + PAD_BOTTOM;

  const logos = new Map<string, HTMLImageElement | null>();
  const backdrops = new Map<string, HTMLImageElement | null>();
  // Every mark on the card, whichever layout it is in. The pyramid shows
  // all thirty-two too - sixteen placed and sixteen below the cut.
  const usedIds = pyramid
    ? template.items.map((i) => i.id)
    : [...rows.flatMap((r) => r.ids), ...state.unranked];
  // Backdrops are loaded in the same pass rather than lazily: the canvas
  // draws in one synchronous sweep, so anything not resolved by here is
  // simply missing from the card.
  const [brandLogo, ...loaded] = await Promise.all([
    loadImage(BRAND_LOGO_SRC),
    ...usedIds.map((id) => loadImage(resolveItem(template, id).imageUrl)),
    ...usedIds.map((id) => {
      const url = resolveItem(template, id).backdropUrl;
      return url ? loadImage(url) : Promise.resolve(null);
    }),
  ]);
  usedIds.forEach((id, i) => logos.set(id, loaded[i]));
  usedIds.forEach((id, i) => backdrops.set(id, loaded[usedIds.length + i]));

  const pixelRatio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * pixelRatio;
  canvas.height = totalHeight * pixelRatio;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.scale(pixelRatio, pixelRatio);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  let cursorY = PAD_TOP;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.font = `${HEADER_EYEBROW_PX}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("SIDELINE BREW · TIER LIST", WIDTH / 2, cursorY + HEADER_EYEBROW_PX);
  cursorY += HEADER_EYEBROW_PX + HEADER_EYEBROW_GAP;

  ctx.font = `${HEADER_TITLE_PX}px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(fitText(ctx, state.title, WIDTH - PAD_X * 2), WIDTH / 2, cursorY + HEADER_TITLE_PX * 0.86);
  cursorY += HEADER_TITLE_PX + HEADER_TITLE_GAP;

  // Nothing between the title and the board. The name and the count that
  // used to sit here said nothing the card doesn't already show - the
  // ranking IS the count - and put a username on an image whose whole job
  // is to be posted somewhere else.
  cursorY += 20;

  ctx.textAlign = "left";

  if (shape) {
    drawPyramid(ctx, displayFont, {
      // Centred, because a shape's width is its OWN now rather than the
      // board's: a diamond or a podium is narrower than the card, and
      // drawn from the left margin it sits off to one side.
      x: PAD_X + (WIDTH - PAD_X * 2 - shape.w) / 2,
      y: cursorY,
      shape,
      bands: pyramidBands(state.tiers, caps),
      slots: pyramid!,
      logos,
      backdrops,
      template,
    });
    cursorY += shape.height + 14;

    ctx.textAlign = "left";
    ctx.font = `13px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`MISSED THE CUT (${missed.length})`, PAD_X, cursorY + 13);
    cursorY += 26;
    const cutH = rowHeight(missed.length, shape.chip, PER_ROW);
    drawPool(ctx, {
      x: PAD_X,
      y: cursorY,
      h: cutH,
      ids: missed,
      chip: shape.chip,
      perRow: PER_ROW,
      logos,
      backdrops,
      template,
    });
    cursorY += cutH + ROW_GAP;

    drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
    });
  }

  // The board is a single rounded black block; rows are drawn inside one
  // clip so the top and bottom rows get their outer corners cut by it,
  // exactly like the live board.
  const boardH = rows.reduce((h, r) => h + rowHeight(r.ids.length, chip, perRow), 0);
  const boardR = { tl: ROW_RADIUS, tr: ROW_RADIUS, br: ROW_RADIUS, bl: ROW_RADIUS };
  roundRectPath(ctx, PAD_X, cursorY, WIDTH - PAD_X * 2, boardH, boardR);
  ctx.fillStyle = "#000000";
  ctx.fill();

  ctx.save();
  roundRectPath(ctx, PAD_X, cursorY, WIDTH - PAD_X * 2, boardH, boardR);
  ctx.clip();
  for (const [i, row] of rows.entries()) {
    const h = rowHeight(row.ids.length, chip, perRow);
    drawRow(ctx, displayFont, {
      x: PAD_X,
      y: cursorY,
      h,
      label: tierLabelFor(row.tier, i),
      accent: row.tier.accent,
      labelSize: pickRailSize(tierLabelFor(row.tier, i)),
      ids: row.ids,
      chip,
      perRow,
      logos,
      backdrops,
      template,
      first: i === 0,
    });
    cursorY += h;
  }
  ctx.restore();

  roundRectPath(ctx, PAD_X, cursorY - boardH, WIDTH - PAD_X * 2, boardH, boardR);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.stroke();
  cursorY += 14;

  if (showUnranked) {
    ctx.textAlign = "left";
    ctx.font = `13px system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(`STILL UNRANKED (${state.unranked.length})`, PAD_X, cursorY + 13);
    cursorY += 26;
    const h = rowHeight(state.unranked.length, chip, perRow);
    drawPool(ctx, { x: PAD_X, y: cursorY, h, ids: state.unranked, chip, perRow, logos, backdrops, template });
    cursorY += h + ROW_GAP;
  }

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}

// The pyramid: one band per row, however many the list's shape has, and
// the same black ground and hairline separators as the rows. Drawn from
// the same solvePyramid the board uses, so the card is the board's
// geometry at a different size rather than a second guess at it - which
// now matters more, because the board's shape is the list's own.
function drawPyramid(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  o: {
    x: number;
    y: number;
    shape: PyramidShape;
    bands: { label: string; accent: string }[];
    slots: (string | null)[];
    logos: Map<string, HTMLImageElement | null>;
    backdrops: Map<string, HTMLImageElement | null>;
    template: TierTemplate;
  },
) {
  const { w, T, rowH, height, leftEdgeAt, verts } = o.shape;

  o.shape.caps.forEach((_, row) => {
    const yTop = o.y + row * rowH;
    // Three heights per row, not two: a row that turns from out to in has
    // its corner halfway down, and drawing it top-to-bottom only would
    // cut the point off a diamond.
    const ys = [row * rowH, row * rowH + rowH / 2, (row + 1) * rowH];
    const edge = ys.map(leftEdgeAt);
    const a = edge[0];

    // The row, black, cut to the slope on both sides.
    ctx.beginPath();
    ys.forEach((y, i) => ctx[i ? "lineTo" : "moveTo"](o.x + w - edge[i], o.y + y));
    for (let i = ys.length - 1; i >= 0; i--) ctx.lineTo(o.x + edge[i], o.y + ys[i]);
    ctx.closePath();
    ctx.fillStyle = "#000000";
    ctx.fill();

    // The band, flush with the left slope and running parallel to it.
    ctx.beginPath();
    ys.forEach((y, i) => ctx[i ? "lineTo" : "moveTo"](o.x + edge[i] + T, o.y + y));
    for (let i = ys.length - 1; i >= 0; i--) ctx.lineTo(o.x + edge[i], o.y + ys[i]);
    ctx.closePath();
    ctx.fillStyle = o.bands[row].accent;
    ctx.fill();

    // Clipped to the band, because the band is a parallelogram and a name
    // tall enough to wrap reaches past its slanted edges.
    ctx.save();
    ctx.clip();
    drawRailLabel(ctx, o.bands[row].label, o.x + leftEdgeAt(row * rowH + rowH / 2), yTop, rowH, pickRailSize(o.bands[row].label), false, T);
    ctx.restore();

    // Same hairline as the rows, across the row AND its band.
    if (row > 0) {
      ctx.fillStyle = "#000000";
      ctx.fillRect(o.x + a, yTop, w - a * 2, ROW_LINE);
      ctx.fillStyle = "rgba(255,255,255,0.09)";
      ctx.fillRect(o.x + a, yTop, w - a * 2, ROW_LINE);
    }
  });

  for (let slot = 0; slot < rankedIn(o.shape.caps); slot++) {
    const id = o.slots[slot];
    if (!id) continue;
    const logo = o.logos.get(id) ?? null;
    if (!logo) continue;
    const { x, y, size } = slotRect(o.shape, slot);
    drawMark(ctx, displayFont, logo, o.backdrops.get(id) ?? null, o.template, id, o.x + x, o.y + y, size);
  }

  // The silhouette. Pure black on this ground has almost no contrast, so
  // without it the shape has no visible boundary at all.
  ctx.beginPath();
  verts.forEach((v, i) => ctx[i ? "lineTo" : "moveTo"](o.x + (w + v.width) / 2, o.y + v.y));
  for (let i = verts.length - 1; i >= 0; i--) ctx.lineTo(o.x + (w - verts[i].width) / 2, o.y + verts[i].y);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.17)";
  ctx.stroke();
  void height;
}

// The strip under the board - unranked in the tier list, missed the cut
// in the pyramid. Same treatment either way.
function drawPool(
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    h: number;
    ids: string[];
    chip: number;
    perRow: number;
    logos: Map<string, HTMLImageElement | null>;
    backdrops: Map<string, HTMLImageElement | null>;
    template: TierTemplate;
  },
) {
  const w = WIDTH - PAD_X * 2;
  roundRectPath(ctx, o.x, o.y, w, o.h, { tl: ROW_RADIUS, tr: ROW_RADIUS, br: ROW_RADIUS, bl: ROW_RADIUS });
  ctx.fillStyle = "#000000";
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.stroke();

  o.ids.forEach((id, i) => {
    const logo = o.logos.get(id) ?? null;
    if (!logo) return;
    const cx = o.x + ROW_PAD + (i % o.perRow) * (o.chip + CHIP_GAP);
    const cy = o.y + ROW_PAD + Math.floor(i / o.perRow) * (o.chip + CHIP_GAP);
    ctx.save();
    ctx.globalAlpha = 0.45;
    drawMark(ctx, `${o.chip}px sans-serif`, logo, o.backdrops.get(id) ?? null, o.template, id, cx, cy, o.chip);
    ctx.restore();
  });
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  logo: HTMLImageElement,
  backdrop: HTMLImageElement | null,
  template: TierTemplate,
  id: string,
  x: number,
  y: number,
  size: number,
) {
  if (template.itemStyle === "portrait") {
    drawPortraitChip(ctx, displayFont, logo, backdrop, resolveItem(template, id), x, y, size);
  } else {
    // Logos are square, so stretching to the chip and fitting inside it
    // are the same operation.
    ctx.drawImage(logo, x, y, size, size);
  }
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  o: {
    x: number;
    y: number;
    h: number;
    label: string;
    accent: string;
    ids: string[];
    chip: number;
    perRow: number;
    logos: Map<string, HTMLImageElement | null>;
    backdrops: Map<string, HTMLImageElement | null>;
    template: TierTemplate;
    labelSize: number;
    muted?: boolean;
    first?: boolean;
  }
) {
  const w = WIDTH - PAD_X * 2;

  if (o.muted) {
    roundRectPath(ctx, o.x, o.y, w, o.h, { tl: ROW_RADIUS, tr: ROW_RADIUS, br: ROW_RADIUS, bl: ROW_RADIUS });
    ctx.fillStyle = "#000000";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.stroke();
  }

  // A plain block of accent, matching the board: the chevron's point ate
  // the right-hand sixth of the rail, which is the part a wrapped name
  // needs most.
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.10)" : o.accent;
  ctx.fillRect(o.x, o.y, RAIL_W, o.h);

  drawRailLabel(ctx, o.label, o.x, o.y, o.h, o.labelSize, o.muted);

  // The separator goes on LAST, over the rail as well as the row. On the
  // board it is a border on the row and the rail sits inside it, so the
  // colour blocks are parted by a dark line too - drawing it first meant
  // the rail painted straight over it and the blocks ran together.
  if (!o.muted && !o.first) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(o.x, o.y, w, ROW_LINE);
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(o.x, o.y, w, ROW_LINE);
  }

  ctx.textBaseline = "alphabetic";
  const startX = o.x + RAIL_W + ROW_PAD;
  o.ids.forEach((id, i) => {
    const col = i % o.perRow;
    const line = Math.floor(i / o.perRow);
    const cx = startX + col * (o.chip + CHIP_GAP);
    const cy = o.y + ROW_PAD + line * (o.chip + CHIP_GAP);
    const logo = o.logos.get(id) ?? null;
    if (!logo) return;
    ctx.save();
    if (o.muted) ctx.globalAlpha = 0.45;
    if (o.template.itemStyle === "portrait") {
      drawPortraitChip(ctx, displayFont, logo, o.backdrops.get(id) ?? null, resolveItem(o.template, id), cx, cy, o.chip);
    } else {
      // Logos are square, so stretching to the chip and fitting inside it
      // are the same operation. Left as-is rather than routed through the
      // cover path, which would only add rounding differences to a card
      // that has looked like this since it shipped.
      ctx.drawImage(logo, cx, cy, o.chip, o.chip);
    }
    ctx.restore();
  });
}

// The rail's type, matching the board: the body face at 600 rather than
// the display face, a few points smaller, and wrapping rather than
// ellipsising. A name is the whole point of renaming a tier, and on one
// line "SUPER BOWL CONTENDER" came out as "SUPER BO…" - the card showed
// the ranking but not what it meant.
function drawRailLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  h: number,
  // Solved once for the whole card, not per row: sized individually, a
  // board of "S / A / CHAMPIONSHIP / F" set three rails at 26px and one
  // at 13, which reads as four unrelated labels rather than one scale.
  size: number,
  muted?: boolean,
  // The rows' rail is a fixed width and `x` is its left edge; the
  // pyramid's band is the shape's thickness and `x` is where its left
  // edge crosses this row's middle. Same drawing either way.
  bandW?: number,
) {
  const w = bandW ?? RAIL_W;
  ctx.font = railFont(size);
  const lines = wrapWords(ctx, label.toUpperCase().split(/\s+/).filter(Boolean), w - 16);
  ctx.fillStyle = muted ? "rgba(255,255,255,0.45)" : "#0c1830";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = size * 1.18;
  const firstY = y + h / 2 - ((lines.length - 1) * lineH) / 2;
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, firstY + i * lineH));
}


// Greedy wrap at spaces, and inside a word when the word alone is wider
// than the line. That last part is what the board does too (break-words),
// and without it the only remaining move was an ellipsis - which on the
// pyramid's much narrower band turned "CHAMPIONSHIP" into "CHAMPIONS…",
// naming nothing.
function wrapWords(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  const flush = () => {
    if (line) lines.push(line);
    line = "";
  };
  for (const word of words) {
    for (const piece of breakWord(ctx, word, maxWidth)) {
      const next = line ? `${line} ${piece}` : piece;
      if (!line || ctx.measureText(next).width <= maxWidth) {
        line = next;
        continue;
      }
      flush();
      line = piece;
    }
  }
  flush();
  return lines;
}

// One word, cut into the widest chunks that fit. A word that already fits
// comes back untouched, which is every ordinary tier name.
function breakWord(ctx: CanvasRenderingContext2D, word: string, maxWidth: number): string[] {
  if (ctx.measureText(word).width <= maxWidth) return [word];
  const pieces: string[] = [];
  let piece = "";
  for (const ch of word) {
    if (piece && ctx.measureText(piece + ch).width > maxWidth) {
      pieces.push(piece);
      piece = ch;
    } else {
      piece += ch;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

// The same two flat sizes the board uses, scaled to this card's wider
// rail. Sized any other way, a screenshot of your list would not look
// like your list.
const LETTER_PX = 24;
const NAME_PX = 18;
const isLetter = (label: string) => label.trim().length <= 2 && !/\s/.test(label.trim());
const pickRailSize = (label: string) => (isLetter(label) ? LETTER_PX : NAME_PX);


// Shrinks a string until it fits, then ellipsises - a 60-char custom
// title must not run past the canvas edge.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

// The portrait chip from TierItemChip, in canvas terms. Kept deliberately
// in step with it: a share card that frames or captions a face
// differently from the board it came from reads as a different list.
function drawPortraitChip(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  img: CanvasImageSource,
  backdrop: CanvasImageSource | null,
  item: TierItem,
  x: number,
  y: number,
  size: number,
) {
  const radius = size * 0.17;
  ctx.save();
  ctx.beginPath();
  // roundRect is available in every browser that can render this card at
  // all - it is the same canvas the board already exports through.
  ctx.roundRect(x, y, size, size, radius);
  ctx.clip();

  const plate = ctx.createLinearGradient(x, y, x + size, y + size);
  plate.addColorStop(0, item.accent);
  plate.addColorStop(1, `${item.accent}66`);
  ctx.fillStyle = plate;
  ctx.fillRect(x, y, size, size);

  // The team mark, ghosted behind the player. Same scale, same opacity
  // and same centring as the board's chip - a card that frames the
  // backdrop differently from the board reads as a different list.
  if (backdrop) {
    const bw = size * BACKDROP_SCALE;
    ctx.save();
    ctx.globalAlpha = BACKDROP_OPACITY;
    ctx.drawImage(backdrop, x + (size - bw) / 2, y + (size - bw) / 2, bw, bw);
    ctx.restore();
  }

  // object-cover, object-top: fill the square from the source's centre
  // horizontally and its top edge vertically, which is where ESPN frames
  // the head.
  const sw = (img as HTMLImageElement).naturalWidth || size;
  const sh = (img as HTMLImageElement).naturalHeight || size;
  const scale = Math.max(size / sw, size / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(img, x + (size - dw) / 2, y, dw, dh);

  const fade = ctx.createLinearGradient(x, y + size * 0.5, x, y + size);
  fade.addColorStop(0, "rgba(0,0,0,0)");
  fade.addColorStop(0.55, "rgba(0,0,0,0.45)");
  fade.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = fade;
  ctx.fillRect(x, y + size * 0.5, size, size * 0.5);

  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const name = shareSurname(item.label);
  let fontPx = Math.max(8, size * 0.17);
  ctx.font = `${fontPx}px ${displayFont}`;
  // Shrink rather than clip: a surname cut in half names nobody.
  while (fontPx > 7 && ctx.measureText(name).width > size - 6) {
    fontPx -= 1;
    ctx.font = `${fontPx}px ${displayFont}`;
  }
  ctx.fillText(name, x + size / 2, y + size - size * 0.06);
  ctx.restore();
}

// Same rule as the chip's own surname(): suffixes ride along, because
// dropping one can leave a father and son indistinguishable.
const SHARE_SUFFIXES = new Set(["jr.", "sr.", "ii", "iii", "iv", "v"]);
function shareSurname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const tail = parts.length - (SHARE_SUFFIXES.has(parts[parts.length - 1].toLowerCase()) ? 2 : 1);
  return parts.slice(tail).join(" ");
}
