import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { DayGroup, FlowItem, PickStats, PickTag, splitIntoColumns, computePickStats, computePickTags } from "@/lib/pickLayout";

// Hand-drawn on a <canvas> instead of screenshotting the live DOM (via
// html-to-image or similar). WebKit has long-standing bugs rendering
// cross-origin <img> elements inside that class of library's SVG
// foreignObject step - confirmed on-device via debug logging that every
// logo loaded and inlined successfully, yet still came out blank in the
// captured PNG. Canvas 2D drawImage()/fillText() are plain, universally
// supported primitives with none of that baggage.

const WIDTH = 840;
const PAD_X = 48;
const PAD_TOP = 40;
const PAD_BOTTOM = 56;
const PILL_W = 343;
const PILL_H = 80;
const FOOTER_H = 26;
const LOGO_AREA_H = PILL_H - FOOTER_H;
const GAP_X = 32;
const GAP_Y = 16;
const HEADER_ROW_H = 56;
const BG = "#0e1b33";
const BRAND_LOGO_SRC = "/press-logo.png";
const BRAND_FOOTER_H = 150;

const BORDER_WIDTH = 4;
const PICKED_BORDER_WIDTH = 5;

function darken(hex: string, factor: number, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function resolveDisplayFont(): string {
  if (typeof document === "undefined") return "sans-serif";
  const probe = document.querySelector("h1");
  const family = probe ? getComputedStyle(probe).fontFamily : "";
  return family || "sans-serif";
}

type Radii = { tl: number; tr: number; br: number; bl: number };

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: Radii) {
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

function drawStatPill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string,
  valueColor: string,
  value: string,
  label: string,
  logo?: HTMLImageElement | null
) {
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = valueColor;
  ctx.font = `16px ${displayFont}`;
  const valueY = y + h * 0.4;

  if (logo) {
    const logoH = 26;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    const valueWidth = ctx.measureText(value).width;
    const totalW = logoW + 4 + valueWidth;
    const startX = x + w / 2 - totalW / 2;
    ctx.drawImage(logo, startX, valueY - logoH * 0.72, logoW, logoH);
    ctx.textAlign = "left";
    ctx.fillText(value, startX + logoW + 4, valueY);
    ctx.textAlign = "center";
  } else {
    ctx.fillText(value, x + w / 2, valueY);
  }

  ctx.font = "9px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, x + w / 2, y + h * 0.75);
}

function rowHeight(a: FlowItem | undefined, b: FlowItem | undefined) {
  const h = (item: FlowItem | undefined) => (item?.type === "game" ? PILL_H : item?.type === "header" ? HEADER_ROW_H : 0);
  return Math.max(h(a), h(b));
}

function drawDayHeader(ctx: CanvasRenderingContext2D, displayFont: string, label: string, x: number, y: number, w: number, h: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#ffffff";
  ctx.font = `28px ${displayFont}`;
  ctx.fillText(label, x + w / 2, y + h - 10);
}

function drawTeamHalf(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    side: "left" | "right";
    team: (typeof TEAMS)[TeamAbbr];
    isPicked: boolean;
    isFaded: boolean;
    tag?: PickTag;
    spreadLabel?: string;
    record: string;
    logo: HTMLImageElement | null;
  }
) {
  const { x, y, w, h, side, team, isPicked, isFaded, tag, spreadLabel, record, logo } = opts;
  const radius = h / 2;
  const r: Radii =
    side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };

  const borderColor = isPicked ? "#4ade80" : isFaded ? "rgba(255,255,255,0.35)" : "#ffffff";
  const borderWidth = isPicked ? PICKED_BORDER_WIDTH : BORDER_WIDTH;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  // `ctx.filter` (grayscale/brightness) isn't reliable across every canvas
  // implementation - confirmed it silently no-ops on at least one real
  // device this shipped to. A plain translucent-black overlay drawn last,
  // using nothing but fillRect+rgba, dims and mutes the whole half
  // (background, logo, footer, text alike) with zero dependency on filter
  // support.
  ctx.fillStyle = team.color;
  ctx.fillRect(x, y, w, h);

  if (logo) {
    const logoH = 117;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, x + w / 2 - logoW / 2, y + LOGO_AREA_H / 2 - logoH / 2, logoW, logoH);
  }

  ctx.fillStyle = darken(team.color, 0.6, 0.93);
  ctx.fillRect(x, y + LOGO_AREA_H, w, FOOTER_H);

  const footerMidY = y + LOGO_AREA_H + FOOTER_H / 2;
  ctx.textBaseline = "middle";
  let textX = x + w / 2;
  if (spreadLabel) {
    ctx.font = `14px ${displayFont}`;
    ctx.fillStyle = "#ffffff";
    const spreadW = ctx.measureText(spreadLabel).width;
    const recordFont = "10px system-ui, sans-serif";
    ctx.font = recordFont;
    const recordW = ctx.measureText(record).width;
    const totalW = spreadW + 6 + recordW;
    textX = x + w / 2 - totalW / 2;
    ctx.textAlign = "left";
    ctx.font = `14px ${displayFont}`;
    ctx.fillText(spreadLabel, textX, footerMidY);
    ctx.font = recordFont;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(record, textX + spreadW + 6, footerMidY);
  } else {
    ctx.textAlign = "center";
    ctx.font = "10px system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.fillText(record, x + w / 2, footerMidY);
  }

  if (isPicked) {
    ctx.fillStyle = "rgba(74,222,128,0.16)";
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `60px ${displayFont}`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText("W", 0, 4);
    ctx.fillStyle = "#4ade80";
    ctx.fillText("W", 0, 4);
    ctx.restore();
  }

  if (isFaded) {
    ctx.fillStyle = "rgba(6,10,20,0.6)";
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();

  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  if (isPicked) {
    ctx.shadowColor = "rgba(74,222,128,0.6)";
    ctx.shadowBlur = 6;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (tag) {
    // CSS rotates the badge around its own center by default; rotating
    // around a corner (as this used to) swings it visibly off-target. Only
    // let it protrude ~12px past the pill edge - GAP_X between columns is
    // 32px, and a wider protrusion bleeds into the neighboring pill.
    const protrusion = 12;
    const centerX = side === "left" ? x - protrusion + 19 : x + w + protrusion - 19;
    const centerY = y - 8 + 19;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(((side === "left" ? -22 : 22) * Math.PI) / 180);
    ctx.font = "38px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.fillText(tag.emoji, 0, 0);
    ctx.restore();
  }
}

export type ShareImageParams = {
  games: Game[];
  groups: DayGroup[];
  picks: Record<string, TeamAbbr>;
  week: number;
};

export async function renderShareImage(params: ShareImageParams): Promise<Blob> {
  const { games, groups, picks, week } = params;
  const pickedCount = Object.keys(picks).length;
  const stats: PickStats = computePickStats(games, picks);
  const tags = computePickTags(games, picks);
  const { col1, col2 } = splitIntoColumns(groups);
  const rowCount = Math.max(col1.length, col2.length);

  const displayFont = resolveDisplayFont();
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.load(`16px ${displayFont}`);
      await document.fonts.ready;
    } catch {
      // fall through with whatever font is available
    }
  }

  const logoUrls = new Set<string>();
  games.forEach((g) => {
    logoUrls.add(TEAMS[g.away].logo);
    logoUrls.add(TEAMS[g.home].logo);
  });
  if (stats.boldestTeam) logoUrls.add(stats.boldestTeam.logo);
  const [logoEntries, brandLogo] = await Promise.all([
    Promise.all(Array.from(logoUrls).map(async (url) => [url, await loadImage(url)] as const)),
    loadImage(BRAND_LOGO_SRC),
  ]);
  const logos = new Map(logoEntries);

  let bodyHeight = 0;
  for (let i = 0; i < rowCount; i++) {
    bodyHeight += rowHeight(col1[i], col2[i]);
    if (i < rowCount - 1) bodyHeight += GAP_Y;
  }

  const headerHeight = 64 + 8 + 44;
  const totalHeight = PAD_TOP + headerHeight + 24 + bodyHeight + BRAND_FOOTER_H + PAD_BOTTOM;

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
  ctx.fillStyle = "#ffffff";
  ctx.font = `30px ${displayFont}`;
  ctx.fillText("NFL PICK’EM", WIDTH / 2, cursorY + 28);
  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`Week ${week} · ${pickedCount} / ${games.length} picked`, WIDTH / 2, cursorY + 50);
  cursorY += 64 + 8;

  const pillDefs: Array<{ w: number; borderColor: string; valueColor: string; value: string; label: string; logo?: HTMLImageElement | null }> = [
    { w: 88, borderColor: "#ffffff", valueColor: "#ffffff", value: String(stats.underdogCount), label: "UNDERDOGS" },
    {
      w: 110,
      borderColor: "#4ade80",
      valueColor: "#4ade80",
      value: stats.boldestTeam ? `+${stats.boldestSpread}` : "-",
      label: "BOLDEST PICK",
      logo: stats.boldestTeam ? logos.get(stats.boldestTeam.logo) : undefined,
    },
    { w: 88, borderColor: "#ffffff", valueColor: "#ffffff", value: stats.chalkPct !== null ? `${stats.chalkPct}%` : "-", label: "CHALK" },
  ];
  const pillGap = 8;
  const pillH = 44;
  const totalPillsW = pillDefs.reduce((s, p) => s + p.w, 0) + pillGap * (pillDefs.length - 1);
  let pillX = WIDTH / 2 - totalPillsW / 2;
  for (const p of pillDefs) {
    drawStatPill(ctx, displayFont, pillX, cursorY, p.w, pillH, p.borderColor, p.valueColor, p.value, p.label, p.logo);
    pillX += p.w + pillGap;
  }
  cursorY += pillH + 24;

  const col1X = PAD_X;
  const col2X = PAD_X + PILL_W + GAP_X;

  for (let i = 0; i < rowCount; i++) {
    const h = rowHeight(col1[i], col2[i]);
    [
      { item: col1[i], x: col1X },
      { item: col2[i], x: col2X },
    ].forEach(({ item, x }) => {
      if (!item || item.type === "blank") return;
      if (item.type === "header") {
        drawDayHeader(ctx, displayFont, item.label, x, cursorY, PILL_W, h);
        return;
      }
      const game = item.game;
      const away = TEAMS[game.away];
      const home = TEAMS[game.home];
      const picked = picks[game.id];
      const hasPick = !!picked;
      const tag = tags[game.id];
      const halfW = PILL_W / 2;

      const awaySpread =
        game.favorite && game.spread !== undefined
          ? game.favorite === game.away
            ? `-${game.spread}`
            : `+${game.spread}`
          : undefined;
      const homeSpread =
        game.favorite && game.spread !== undefined
          ? game.favorite === game.home
            ? `-${game.spread}`
            : `+${game.spread}`
          : undefined;

      drawTeamHalf(ctx, displayFont, {
        x,
        y: cursorY,
        w: halfW,
        h: PILL_H,
        side: "left",
        team: away,
        isPicked: picked === away.abbr,
        isFaded: hasPick && picked !== away.abbr,
        tag: picked === away.abbr ? tag : undefined,
        spreadLabel: awaySpread,
        record: game.awayRecord ?? "0-0",
        logo: logos.get(away.logo) ?? null,
      });
      drawTeamHalf(ctx, displayFont, {
        x: x + halfW,
        y: cursorY,
        w: halfW,
        h: PILL_H,
        side: "right",
        team: home,
        isPicked: picked === home.abbr,
        isFaded: hasPick && picked !== home.abbr,
        tag: picked === home.abbr ? tag : undefined,
        spreadLabel: homeSpread,
        record: game.homeRecord ?? "0-0",
        logo: logos.get(home.logo) ?? null,
      });
    });
    cursorY += h + GAP_Y;
  }

  cursorY += 20;

  // "POWERED BY" sits inline to the left of the logo mark as one row,
  // rather than stacked above it, so the footer doesn't eat a ton of
  // vertical space.
  const brandLabel = "P O W E R E D   B Y";
  ctx.font = "13px system-ui, sans-serif";
  const brandLabelW = ctx.measureText(brandLabel).width;

  let brandLogoW = 0;
  const brandLogoH = 52;
  if (brandLogo) {
    brandLogoW = (brandLogo.naturalWidth / brandLogo.naturalHeight) * brandLogoH;
  }

  const brandGap = 12;
  const brandRowW = brandLabelW + (brandLogo ? brandGap + brandLogoW : 0);
  const brandRowH = Math.max(13, brandLogoH);
  const brandRowX = WIDTH / 2 - brandRowW / 2;
  const brandRowMidY = cursorY + brandRowH / 2;

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(brandLabel, brandRowX, brandRowMidY);

  if (brandLogo) {
    ctx.drawImage(brandLogo, brandRowX + brandLabelW + brandGap, cursorY + (brandRowH - brandLogoH) / 2, brandLogoW, brandLogoH);
  }
  cursorY += brandRowH + 16;

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `22px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("sidelinebrew.com", WIDTH / 2, cursorY + 20);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
