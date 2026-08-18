import { TierTemplate, resolveItem } from "@/data/tierTemplates";
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

const RAIL_W = 92;
const ROW_GAP = 12;
const ROW_PAD = 10;
const CHIP_GAP = 8;
const ROW_RADIUS = 18;

const BRAND_FOOTER_H = 12 + 104 + 10 + 18 + 10;

export type TierShareParams = {
  state: TierListState;
  template: TierTemplate;
  // Rendered under the title as attribution when we have one.
  authorLabel?: string | null;
};

// Chip size is solved per-row from the widest row, so a 20-team S tier
// still fits on one canvas instead of running off the edge. Rows with
// fewer teams keep the same size so the grid stays visually regular.
function solveChipSize(state: TierListState): number {
  const widest = Math.max(1, ...state.tiers.map((t) => (state.placements[t.id] ?? []).length));
  const available = WIDTH - PAD_X * 2 - RAIL_W - ROW_PAD * 2;
  const fitted = Math.floor((available - (widest - 1) * CHIP_GAP) / widest);
  // Floor keeps 32-in-one-tier legible; ceiling stops a 1-team tier from
  // rendering an absurd 300px logo.
  return Math.max(30, Math.min(64, fitted));
}

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

  const chip = solveChipSize(state);
  const trackW = WIDTH - PAD_X * 2 - RAIL_W - ROW_PAD * 2;
  const perRow = Math.max(1, Math.floor((trackW + CHIP_GAP) / (chip + CHIP_GAP)));

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
    });
    cursorY += h + ROW_GAP;
  }

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
    muted?: boolean;
  }
) {
  const w = WIDTH - PAD_X * 2;
  const r = { tl: ROW_RADIUS, tr: ROW_RADIUS, br: ROW_RADIUS, bl: ROW_RADIUS };

  roundRectPath(ctx, o.x, o.y, w, o.h, r);
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.03)" : `${o.accent}14`;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = o.muted ? "rgba(255,255,255,0.10)" : `${o.accent}66`;
  ctx.stroke();

  // Label rail, clipped to the row's left rounded corners.
  ctx.save();
  roundRectPath(ctx, o.x, o.y, w, o.h, r);
  ctx.clip();
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.05)" : `${o.accent}30`;
  ctx.fillRect(o.x, o.y, RAIL_W, o.h);
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.18)" : o.accent;
  ctx.fillRect(o.x + RAIL_W - 2, o.y, 2, o.h);
  ctx.restore();

  const labelSize = o.label.length > 4 ? 16 : 30;
  ctx.font = `${labelSize}px ${displayFont}`;
  ctx.fillStyle = o.muted ? "rgba(255,255,255,0.35)" : o.accent;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(fitText(ctx, o.label, RAIL_W - 12), o.x + RAIL_W / 2, o.y + o.h / 2);

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
    ctx.drawImage(logo, cx, cy, o.chip, o.chip);
    ctx.restore();
  });
}

// Shrinks a string until it fits, then ellipsises - a 60-char custom
// title or a 14-char tier label must not run past the canvas edge.
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}
