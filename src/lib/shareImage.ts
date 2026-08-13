import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { SpecialPick, MAX_LOCKS, MAX_BLOWOUTS } from "@/hooks/usePicks";
import { DayGroup, FlowItem, PickStats, splitIntoColumns, computePickStats } from "@/lib/pickLayout";

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

const BORDER_WIDTH = 4;
const PICKED_BORDER_WIDTH = 5;
const SPECIAL_BORDER_WIDTH = 5;

const SPECIAL_STYLE: Record<SpecialPick, { color: string; glow: string; emoji: string }> = {
  lock: { color: "#fbbf24", glow: "rgba(251,191,36,0.7)", emoji: "\u{1F512}" },
  blowout: { color: "#f97316", glow: "rgba(249,115,22,0.7)", emoji: "\u{1F4A5}" },
};

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
    special?: SpecialPick;
    spreadLabel?: string;
    record: string;
    logo: HTMLImageElement | null;
  }
) {
  const { x, y, w, h, side, team, isPicked, isFaded, special, spreadLabel, record, logo } = opts;
  const radius = h / 2;
  const r: Radii =
    side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };

  const borderColor = special ? SPECIAL_STYLE[special].color : isPicked ? "#4ade80" : "#ffffff";
  const borderWidth = special ? SPECIAL_BORDER_WIDTH : isPicked ? PICKED_BORDER_WIDTH : BORDER_WIDTH;

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  ctx.filter = isFaded ? "grayscale(0.5) brightness(0.55)" : "none";
  ctx.fillStyle = team.color;
  ctx.fillRect(x, y, w, h);

  if (logo) {
    const logoH = 117;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, x + w / 2 - logoW / 2, y + LOGO_AREA_H / 2 - logoH / 2, logoW, logoH);
  }

  ctx.filter = "none";
  ctx.fillStyle = isFaded ? team.color : darken(team.color, 0.6, 0.93);
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

  ctx.restore();

  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = borderWidth;
  ctx.strokeStyle = borderColor;
  if (isPicked) {
    ctx.shadowColor = special ? SPECIAL_STYLE[special].glow : "rgba(74,222,128,0.6)";
    ctx.shadowBlur = special ? 8 : 6;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (special) {
    const emoji = SPECIAL_STYLE[special].emoji;
    const badgeX = side === "left" ? x - 4 : x + w + 4;
    const badgeY = y - 2;
    ctx.save();
    ctx.translate(badgeX, badgeY);
    ctx.rotate(((side === "left" ? -22 : 22) * Math.PI) / 180);
    ctx.font = "42px system-ui, sans-serif";
    ctx.textAlign = side === "left" ? "right" : "left";
    ctx.textBaseline = "top";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.fillText(emoji, 0, 0);
    ctx.restore();
  }
}

export type ShareImageParams = {
  games: Game[];
  groups: DayGroup[];
  picks: Record<string, TeamAbbr>;
  specials: Record<string, SpecialPick>;
  week: number;
};

export async function renderShareImage(params: ShareImageParams): Promise<Blob> {
  const { games, groups, picks, specials, week } = params;
  const pickedCount = Object.keys(picks).length;
  const lockedCount = Object.values(specials).filter((s) => s === "lock").length;
  const blowoutCount = Object.values(specials).filter((s) => s === "blowout").length;
  const stats: PickStats = computePickStats(games, picks);
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
  const logoEntries = await Promise.all(
    Array.from(logoUrls).map(async (url) => [url, await loadImage(url)] as const)
  );
  const logos = new Map(logoEntries);

  let bodyHeight = 0;
  for (let i = 0; i < rowCount; i++) {
    bodyHeight += rowHeight(col1[i], col2[i]);
    if (i < rowCount - 1) bodyHeight += GAP_Y;
  }

  const headerHeight = 64 + 8 + 44;
  const totalHeight = PAD_TOP + headerHeight + 24 + bodyHeight + PAD_BOTTOM;

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
    { w: 88, borderColor: "#fbbf24", valueColor: "#fbbf24", value: `${lockedCount}/${MAX_LOCKS}`, label: "LOCKS" },
    { w: 88, borderColor: "#f97316", valueColor: "#f97316", value: `${blowoutCount}/${MAX_BLOWOUTS}`, label: "BLOWOUT" },
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
      const special = specials[game.id];
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
        special: picked === away.abbr ? special : undefined,
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
        special: picked === home.abbr ? special : undefined,
        spreadLabel: homeSpread,
        record: game.homeRecord ?? "0-0",
        logo: logos.get(home.logo) ?? null,
      });
    });
    cursorY += h + GAP_Y;
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
