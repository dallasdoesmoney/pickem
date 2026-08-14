// Small set of canvas-drawing helpers shared by every hand-drawn share
// image in the app (weekly picks, season predictor, ...). Hand-drawn on a
// <canvas> instead of screenshotting the live DOM (via html-to-image or
// similar) - WebKit has long-standing bugs rendering cross-origin <img>
// elements inside that class of library's SVG foreignObject step, while
// plain canvas drawImage()/fillText() have none of that baggage.

export const BRAND_LOGO_SRC = "/press-logo.png";

export function darken(hex: string, factor: number, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
}

export function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function resolveDisplayFont(): string {
  if (typeof document === "undefined") return "sans-serif";
  const probe = document.querySelector("h1");
  const family = probe ? getComputedStyle(probe).fontFamily : "";
  return family || "sans-serif";
}

export type Radii = { tl: number; tr: number; br: number; bl: number };

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Radii) {
  ctx.beginPath();
  ctx.moveTo(x + r.tl, y);
  ctx.lineTo(x + w - r.tr, y);
  ctx.arcTo(x + w, y, x + w, y + r.tr, r.tr);
  ctx.lineTo(x + w, y + h - r.br);
  ctx.arcTo(x + w, y + h, x + w - r.br, y + h, r.br);
  ctx.lineTo(x + r.bl, y + h);
  ctx.arcTo(x, y + h, x, y + h - r.bl, r.bl);
  ctx.lineTo(x, y + r.tl);
  ctx.arcTo(x, y, x + r.tl, y, r.tl);
  ctx.closePath();
}

// Shared team-half pill chrome - used by both the weekly picks share image
// and the season predictor's, so the two can't drift out of sync the way
// they did before this was extracted (different pill sizes, letter
// placement, and border-dimming behavior between the two pages).
export const PILL_W = 343;
export const PILL_H = 80;
export const PILL_FOOTER_H = 26;
export const PILL_LOGO_AREA_H = PILL_H - PILL_FOOTER_H;
export const PILL_BORDER_WIDTH = 4;
export const PILL_OUTCOME_BORDER_WIDTH = 5;
export const WIN_COLOR = "#64e066";
export const WIN_COLOR_RGB = "100,224,102";
export const LOSS_COLOR = "#ef4444";
export const LOSS_COLOR_RGB = "239,68,68";
// What white looks like under the same brightness(0.55) that dims a faded
// half's fill/logo - a solid opaque gray, NOT a translucent white (a
// translucent stroke lets the fill show through the border itself, which
// reads as a rendering bug rather than a muted color).
export const FADED_BORDER_COLOR = "#8c8c8c";

export type PillOutcome = "win" | "loss" | null;

export type PillHalfOpts = {
  x: number;
  y: number;
  w: number;
  h: number;
  side: "left" | "right";
  team: { color: string };
  outcome: PillOutcome;
  isFaded: boolean;
  logo: HTMLImageElement | null;
};

// Fill + logo + footer band + optional footer content + outcome tint/letter
// + fade dim, all clipped to the half's own rounded shape. Border is a
// separate pass (drawPillHalfBorder) - a border stroke is centered on the
// shared seam between two halves, so drawing a half's fill after the other
// half's border has already run there would paint over part of that stroke.
export function drawPillHalfFill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  opts: PillHalfOpts,
  drawFooterContent?: (ctx: CanvasRenderingContext2D, footerMidY: number) => void
) {
  const { x, y, w, h, side, team, outcome, isFaded, logo } = opts;
  const radius = h / 2;
  const r: Radii = side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };
  const logoAreaH = h - PILL_FOOTER_H;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  ctx.fillStyle = team.color;
  ctx.fillRect(x, y, w, h);

  if (logo) {
    const logoH = 117;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, x + w / 2 - logoW / 2, y + logoAreaH / 2 - logoH / 2, logoW, logoH);
  }

  ctx.fillStyle = isFaded ? team.color : darken(team.color, 0.6, 0.93);
  ctx.fillRect(x, y + logoAreaH, w, PILL_FOOTER_H);

  if (drawFooterContent) drawFooterContent(ctx, y + logoAreaH + PILL_FOOTER_H / 2);

  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;
  const outcomeRgb = outcome === "win" ? WIN_COLOR_RGB : outcome === "loss" ? LOSS_COLOR_RGB : null;

  if (outcomeColor) {
    ctx.fillStyle = `rgba(${outcomeRgb},0.16)`;
    ctx.fillRect(x, y, w, h);

    // Centered on the half's FULL height (not just the logo area) - matches
    // the weekly picks page exactly, so the letter sits at the same visual
    // height on both pages.
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `60px ${displayFont}`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    const letter = outcome === "win" ? "W" : "L";
    ctx.strokeText(letter, 0, 4);
    ctx.fillStyle = outcomeColor;
    ctx.fillText(letter, 0, 4);
    ctx.restore();
  }

  // Same proven-reliable dimming trick used everywhere else in the app - a
  // plain translucent overlay instead of ctx.filter, which silently no-ops
  // on at least one real device this shipped to.
  if (isFaded) {
    ctx.fillStyle = "rgba(6,10,20,0.6)";
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();
}

// Always fully opaque - the outcome color when there is one, a solid
// dimmed gray (FADED_BORDER_COLOR) when the half is faded, white
// otherwise. The faded case is deliberately opaque, never translucent - a
// translucent stroke lets the fill/logo underneath show through the border
// itself, which reads as a rendering bug rather than a muted color.
// Callers must draw whichever half has an outcome LAST via
// drawPillBordersOutcomeLast - a border stroke is centered on the shared
// seam, so the one drawn last wins those pixels.
export function drawPillHalfBorder(ctx: CanvasRenderingContext2D, opts: PillHalfOpts) {
  const { x, y, w, h, side, outcome, isFaded } = opts;
  const radius = h / 2;
  const r: Radii = side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };
  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;

  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = outcomeColor ? PILL_OUTCOME_BORDER_WIDTH : PILL_BORDER_WIDTH;
  ctx.strokeStyle = outcomeColor ?? (isFaded ? FADED_BORDER_COLOR : "#ffffff");
  if (outcomeColor) {
    ctx.shadowColor = `rgba(${outcome === "win" ? WIN_COLOR_RGB : LOSS_COLOR_RGB},0.6)`;
    ctx.shadowBlur = 6;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// Draws both halves' borders with whichever side has an outcome (if any)
// last, so its colored ring always wins the shared center seam regardless
// of which side it's on.
export function drawPillBordersOutcomeLast(ctx: CanvasRenderingContext2D, awayOpts: PillHalfOpts, homeOpts: PillHalfOpts) {
  if (awayOpts.outcome) {
    drawPillHalfBorder(ctx, homeOpts);
    drawPillHalfBorder(ctx, awayOpts);
  } else {
    drawPillHalfBorder(ctx, awayOpts);
    drawPillHalfBorder(ctx, homeOpts);
  }
}

// Card/pill: logo on the left, "Powered by" + url stacked on the right,
// framed in a bordered rounded rect so the footer reads as one distinct
// block rather than loose elements floating in space. Sized to its own
// content (logo + longer of the two text lines) instead of a fixed width,
// so it doesn't carry dead space when the content is narrower than the box.
export function drawBrandFooter(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  startY: number,
  brandLogo: HTMLImageElement | null,
  canvasWidth: number
) {
  const logoAspect = brandLogo ? brandLogo.naturalWidth / brandLogo.naturalHeight : 1;
  let y = startY + 14;

  // Logo size is set directly (not derived from a tall cardH) so the card
  // can stay close-fitted to its content - a tight vertical pad instead of
  // a big margin - while the logo itself is still sized independently.
  const padX = 18;
  const padY = 8;
  const logoTextGap = 16;
  const logoH = 100;
  const cardH = logoH + padY * 2;
  const logoW = brandLogo ? logoAspect * logoH : 0;

  ctx.font = "11px system-ui, sans-serif";
  const labelW = ctx.measureText("POWERED BY").width;
  ctx.font = `24px ${displayFont}`;
  const urlW = ctx.measureText("sidelinebrew.com").width;
  const textW = Math.max(labelW, urlW);

  const cardW = padX + logoW + (brandLogo ? logoTextGap : 0) + textW + padX;
  const cardX = canvasWidth / 2 - cardW / 2;
  roundRectPath(ctx, cardX, y, cardW, cardH, { tl: 16, tr: 16, br: 16, bl: 16 });
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Nudged up relative to the vertically-centered text beside it - a purely
  // centered logo read as sitting a touch low next to the two-line text block.
  const logoYShift = 6;
  if (brandLogo) ctx.drawImage(brandLogo, cardX + padX, y + padY - logoYShift, logoW, logoH);

  const textX = cardX + padX + (brandLogo ? logoW + logoTextGap : 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  // Text block stays visually centered in the card regardless of cardH, so
  // enlarging the logo above doesn't need a matching manual reposition here.
  const labelY = cardH / 2 - 10;
  const valueY = cardH / 2 + 20;
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("POWERED BY", textX, y + labelY);
  ctx.font = `24px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("sidelinebrew.com", textX, y + valueY);

  return y + cardH + 10;
}
