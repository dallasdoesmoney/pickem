// Small set of canvas-drawing helpers shared by every hand-drawn share
// image in the app (weekly picks, season predictor, ...). Hand-drawn on a
// <canvas> instead of screenshotting the live DOM (via html-to-image or
// similar) - WebKit has long-standing bugs rendering cross-origin <img>
// elements inside that class of library's SVG foreignObject step, while
// plain canvas drawImage()/fillText() have none of that baggage.

export const BRAND_LOGO_SRC = "/header-logo.png";

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
    ctx.fillStyle = `rgba(${outcomeRgb},0.34)`;
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

// The full icon+wordmark lockup (the same mark used in the site's own
// header, not the small icon-only mark used elsewhere), stacked big above
// a smaller url line, floating directly on the background - no card, so
// it reads as a signature rather than a boxed "powered by" badge.
// Opaque-pixel bounds of header-logo.png as fractions of the bitmap - the
// file bakes in transparent margins, which rendered as dead space no
// matter how tight the surrounding layout was. Cropping to these bounds
// makes logoH the REAL visible height. Measured from the 1200x400 file
// (opaque bbox 26,23 -> 1174,332); re-measure if the logo file changes.
const BRAND_LOGO_CROP = { x: 26 / 1200, y: 23 / 400, w: (1174 - 26) / 1200, h: (332 - 23) / 400 };

export function drawBrandFooter(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  startY: number,
  brandLogo: HTMLImageElement | null,
  canvasWidth: number
) {
  const y = startY + 14;

  const logoH = 140;
  const logoTextGap = 12;
  const urlSize = 24;
  // Aspect of the CROPPED pixel region, not of the crop fractions - w and h
  // above are each a fraction of a DIFFERENT base (bitmap width vs height),
  // so dividing them directly only happens to cancel out correctly for a
  // square source image. header-logo.png is 1200x400, not square.
  const logoAspect = brandLogo ? (brandLogo.naturalWidth * BRAND_LOGO_CROP.w) / (brandLogo.naturalHeight * BRAND_LOGO_CROP.h) : 0;
  const logoW = brandLogo ? logoAspect * logoH : 0;

  if (brandLogo) {
    const sx = brandLogo.naturalWidth * BRAND_LOGO_CROP.x;
    const sy = brandLogo.naturalHeight * BRAND_LOGO_CROP.y;
    const sw = brandLogo.naturalWidth * BRAND_LOGO_CROP.w;
    const sh = brandLogo.naturalHeight * BRAND_LOGO_CROP.h;
    ctx.drawImage(brandLogo, sx, sy, sw, sh, canvasWidth / 2 - logoW / 2, y, logoW, logoH);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `${urlSize}px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("sidelinebrew.com", canvasWidth / 2, y + logoH + logoTextGap + urlSize * 0.8);

  return y + logoH + logoTextGap + urlSize + 10;
}
