import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { TierListState, tierLabelFor } from "@/lib/tierList";
import { BRAND_LOGO_SRC, drawBrandFooter, loadImage, resolveDisplayFont, roundRectPath } from "@/lib/canvasShare";

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
const HEADER_META_PX = 15;

const RAIL_W = 118;
// Rows butt straight into each other now - the board is one block.
const ROW_GAP = 0;
const ROW_PAD = 10;
const CHIP_GAP = 6;
const ROW_RADIUS = 18;

const BRAND_FOOTER_H = 12 + 104 + 10 + 18 + 10;

export type TierShareParams = {
  state: TierListState;
  template: TierTemplate;
  // Rendered under the title as attribution when we have one.
  authorLabel?: string | null;
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

export async function renderTierShareImage({ state, template, authorLabel }: TierShareParams): Promise<Blob> {
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
  const bodyH =
    rows.reduce((h, r) => h + rowHeight(r.ids.length, chip, perRow) + ROW_GAP, 0) +
    (showUnranked ? rowHeight(state.unranked.length, chip, perRow) + ROW_GAP + 26 : 0);

  const headerH =
    HEADER_EYEBROW_PX + HEADER_EYEBROW_GAP + HEADER_TITLE_PX + HEADER_TITLE_GAP + HEADER_META_PX + 20;
  const totalHeight = PAD_TOP + headerH + bodyH + BRAND_FOOTER_H + PAD_BOTTOM;

  const logos = new Map<string, HTMLImageElement | null>();
  const usedIds = [...rows.flatMap((r) => r.ids), ...state.unranked];
  const [brandLogo, ...loaded] = await Promise.all([
    loadImage(BRAND_LOGO_SRC),
    ...usedIds.map((id) => loadImage(resolveItem(template, id).imageUrl)),
  ]);
  usedIds.forEach((id, i) => logos.set(id, loaded[i]));

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

  const ranked = usedIds.length - state.unranked.length;
  const meta = authorLabel
    ? `${authorLabel}  ·  ${ranked}/${template.items.length} ranked`
    : `${ranked}/${template.items.length} ranked`;
  ctx.font = `${HEADER_META_PX}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(meta, WIDTH / 2, cursorY + HEADER_META_PX);
  cursorY += HEADER_META_PX + 20;

  ctx.textAlign = "left";

  // The board is a single rounded black block; rows are drawn inside one
  // clip so the top and bottom chevrons get their outer corners cut by it,
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
      ids: row.ids,
      chip,
      perRow,
      logos,
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
    drawRow(ctx, displayFont, {
      x: PAD_X,
      y: cursorY,
      h,
      label: "—",
      accent: "#64748b",
      ids: state.unranked,
      chip,
      perRow,
      logos,
      template,
      muted: true,
    });
    cursorY += h + ROW_GAP;
  }

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
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
    template: TierTemplate;
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
  } else if (!o.first) {
    // Hairline is the only thing separating one tier from the next.
    ctx.fillStyle = "rgba(255,255,255,0.09)";
    ctx.fillRect(o.x, o.y, w, 1);
  }

  // Chevron rail: solid accent, dark type, point on the right.
  const point = RAIL_W * 0.84;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y);
  ctx.lineTo(o.x + point, o.y);
  ctx.lineTo(o.x + RAIL_W, o.y + o.h / 2);
  ctx.lineTo(o.x + point, o.y + o.h);
  ctx.lineTo(o.x, o.y + o.h);
  ctx.closePath();
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.10)" : o.accent;
  ctx.fill();

  // The rail wraps rather than ellipsising. A name is the whole point of
  // renaming a tier, and on one line "SUPER BOWL CONTENDER" was shrunk to
  // "SUPER BO…" - the card showed the ranking but not what it meant. The
  // widest usable width is `point`, not RAIL_W: the chevron only reaches
  // its full width at the vertical middle, so text sized to RAIL_W would
  // spill out of the taper on the first and last lines.
  const { size: labelSize, lines: labelLines } = layoutRailLabel(ctx, o.label, displayFont, point - 14);
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.45)" : "#0c1830";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = labelSize * 1.12;
  const firstY = o.y + o.h / 2 - ((labelLines.length - 1) * lineH) / 2;
  labelLines.forEach((line, i) => {
    ctx.fillText(line, o.x + point / 2, firstY + i * lineH);
  });

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
      drawPortraitChip(ctx, displayFont, logo, resolveItem(o.template, id), cx, cy, o.chip);
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

// As many lines as the rail can hold before the type gets too small to
// read at a glance. The board allows the same three.
const RAIL_LABEL_MAX_LINES = 3;
const RAIL_LABEL_MIN_PX = 9;

// Greedy wrap at spaces. A single word longer than the line is left to
// overflow here; the caller steps the type down until it stops doing so.
function wrapWords(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  return lines;
}

// Picks the largest size at which the name both wraps inside the line
// budget AND has no single word too wide to wrap (wrapping can't rescue
// one long word - only a smaller size can). Measured against the real
// font rather than estimated from character counts, which is what the
// old length-banded size did and why long names overflowed.
function layoutRailLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  displayFont: string,
  maxWidth: number,
): { size: number; lines: string[] } {
  const n = label.length;
  const band = n <= 2 ? 34 : n <= 5 ? 21 : n <= 9 ? 16 : n <= 14 ? 15 : n <= 22 ? 14 : 13;
  const words = label.split(/\s+/).filter(Boolean);
  if (!words.length) return { size: band, lines: [] };

  let size = band;
  let lines = words;
  for (; size > RAIL_LABEL_MIN_PX; size -= 1) {
    ctx.font = `${size}px ${displayFont}`;
    lines = wrapWords(ctx, words, maxWidth);
    const everyWordFits = words.every((w) => ctx.measureText(w).width <= maxWidth);
    if (everyWordFits && lines.length <= RAIL_LABEL_MAX_LINES) break;
  }
  ctx.font = `${size}px ${displayFont}`;

  // Only reachable if a name won't fit even at the floor, in which case
  // showing most of it beats showing none of the last line.
  if (lines.length > RAIL_LABEL_MAX_LINES) {
    lines = lines.slice(0, RAIL_LABEL_MAX_LINES);
    const last = RAIL_LABEL_MAX_LINES - 1;
    lines[last] = fitText(ctx, `${lines[last]} …`, maxWidth);
  }
  return { size, lines: lines.map((l) => fitText(ctx, l, maxWidth)) };
}

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
