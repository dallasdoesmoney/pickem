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

  const cardH = 104;
  const pad = 18;
  const logoTextGap = 16;
  const logoH = cardH - pad * 2;
  const logoW = brandLogo ? logoAspect * logoH : 0;

  ctx.font = "11px system-ui, sans-serif";
  const labelW = ctx.measureText("POWERED BY").width;
  ctx.font = `24px ${displayFont}`;
  const urlW = ctx.measureText("sidelinebrew.com").width;
  const textW = Math.max(labelW, urlW);

  const cardW = pad + logoW + (brandLogo ? logoTextGap : 0) + textW + pad;
  const cardX = canvasWidth / 2 - cardW / 2;
  roundRectPath(ctx, cardX, y, cardW, cardH, { tl: 16, tr: 16, br: 16, bl: 16 });
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (brandLogo) ctx.drawImage(brandLogo, cardX + pad, y + pad, logoW, logoH);

  const textX = cardX + pad + (brandLogo ? logoW + logoTextGap : 0);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("POWERED BY", textX, y + 42);
  ctx.font = `24px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("sidelinebrew.com", textX, y + 72);

  return y + cardH + 10;
}
