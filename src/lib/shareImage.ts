import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { DayGroup, FlowItem, PickStats, PickTag, splitIntoColumns, computePickStats, computePickTags } from "@/lib/pickLayout";
import {
  BRAND_LOGO_SRC,
  PILL_W,
  PILL_H,
  PillHalfOpts,
  Radii,
  drawBrandFooter,
  drawPillBordersOutcomeLast,
  drawPillHalfFill,
  loadImage,
  resolveDisplayFont,
  roundRectPath,
} from "@/lib/canvasShare";

const WIDTH = 840;
const PAD_X = 48;
const PAD_TOP = 40;
const PAD_BOTTOM = 56;
const GAP_X = 32;
const GAP_Y = 16;
const HEADER_ROW_H = 56;
const BG = "#0e1b33";

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
  logo?: HTMLImageElement | null,
  badgeEmoji?: string
) {
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = valueColor;
  ctx.font = `32px ${displayFont}`;
  const valueY = y + h * 0.42;

  if (logo) {
    const logoH = 66;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    const valueWidth = ctx.measureText(value).width;
    const totalW = logoW + 8 + valueWidth;
    const startX = x + w / 2 - totalW / 2;
    ctx.drawImage(logo, startX, valueY - logoH * 0.72, logoW, logoH);
    ctx.textAlign = "left";
    ctx.fillText(value, startX + logoW + 8, valueY);
    ctx.textAlign = "center";
  } else {
    ctx.fillText(value, x + w / 2, valueY);
  }

  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, x + w / 2, y + h * 0.8);

  if (badgeEmoji) {
    ctx.save();
    ctx.translate(x + 10, y + 2);
    ctx.rotate((-18 * Math.PI) / 180);
    ctx.font = "54px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Chrome multiplies color-emoji glyphs by fillStyle's alpha channel even
    // though it ignores the hue - without resetting to fully opaque here,
    // this badge inherits the label's rgba(255,255,255,0.55) and renders
    // washed out.
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.fillText(badgeEmoji, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
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

type TeamHalfOpts = PillHalfOpts & {
  tag?: PickTag;
  spreadLabel?: string;
  record: string;
};

// This game's own footer content (spread + record) - drawn inside the
// shared drawPillHalfFill so it's clipped, tinted, and dimmed exactly like
// the rest of the half's fill.
function drawGameFooterContent(ctx: CanvasRenderingContext2D, displayFont: string, x: number, w: number, footerMidY: number, spreadLabel: string | undefined, record: string) {
  ctx.textBaseline = "middle";
  if (spreadLabel) {
    ctx.font = `14px ${displayFont}`;
    ctx.fillStyle = "#ffffff";
    const spreadW = ctx.measureText(spreadLabel).width;
    const recordFont = "10px system-ui, sans-serif";
    ctx.font = recordFont;
    const recordW = ctx.measureText(record).width;
    const totalW = spreadW + 6 + recordW;
    const textX = x + w / 2 - totalW / 2;
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
  ctx.textAlign = "center";
}

function drawTeamHalfBadge(ctx: CanvasRenderingContext2D, opts: TeamHalfOpts) {
  const { x, y, w, side, tag } = opts;
  if (!tag) return;
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

const BRAND_FOOTER_H = 12 + 104 + 10 + 18 + 10;

export type ShareImageParams = {
  games: Game[];
  groups: DayGroup[];
  picks: Record<string, TeamAbbr>;
  week: number;
};

export async function renderShareImage(params: ShareImageParams): Promise<Blob> {
  const { games, groups, picks, week } = params;
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

  const headerHeight = 141 + 24 + 88;
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

  // "WEEK N" kicker, mirroring the live header (minus the picks-count
  // sticker - redundant in a shared image since every pick is already
  // visible below).
  const kickerFontPx = 30;
  ctx.font = `${kickerFontPx}px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  const kickerText = `WEEK ${week}`;
  const kickerBaselineY = cursorY + kickerFontPx;
  ctx.fillText(kickerText, WIDTH / 2, kickerBaselineY);
  cursorY += kickerFontPx + 14;

  const dividerW = 48;
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(WIDTH / 2 - dividerW / 2, cursorY, dividerW, 3);
  cursorY += 3 + 20;

  ctx.font = `66px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("NFL PICK’EM", WIDTH / 2, cursorY + 58);
  cursorY += 66 + 8;

  const pillDefs: Array<{ w: number; borderColor: string; valueColor: string; value: string; label: string; logo?: HTMLImageElement | null; badgeEmoji?: string }> = [
    { w: 172, borderColor: "#ffffff", valueColor: "#ffffff", value: String(stats.underdogCount), label: "UNDERDOGS", badgeEmoji: "\u{1F436}" },
    {
      w: 250,
      borderColor: "#4ade80",
      valueColor: "#4ade80",
      value: stats.boldestTeam ? `+${stats.boldestSpread}` : "-",
      label: "BOLDEST PICK",
      logo: stats.boldestTeam ? logos.get(stats.boldestTeam.logo) : undefined,
      badgeEmoji: "\u{1F48E}",
    },
    { w: 172, borderColor: "#ffffff", valueColor: "#ffffff", value: stats.chalkPct !== null ? `${stats.chalkPct}%` : "-", label: "CHALK" },
  ];
  const pillGap = 24;
  const pillH = 88;
  cursorY += 24;
  const totalPillsW = pillDefs.reduce((s, p) => s + p.w, 0) + pillGap * (pillDefs.length - 1);
  let pillX = WIDTH / 2 - totalPillsW / 2;
  for (const p of pillDefs) {
    drawStatPill(ctx, displayFont, pillX, cursorY, p.w, pillH, p.borderColor, p.valueColor, p.value, p.label, p.logo, p.badgeEmoji);
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

      const awayOpts: TeamHalfOpts = {
        x,
        y: cursorY,
        w: halfW,
        h: PILL_H,
        side: "left",
        team: away,
        outcome: picked === away.abbr ? "win" : null,
        isFaded: hasPick && picked !== away.abbr,
        tag: picked === away.abbr ? tag : undefined,
        spreadLabel: awaySpread,
        record: game.awayRecord ?? "0-0",
        logo: logos.get(away.logo) ?? null,
      };
      const homeOpts: TeamHalfOpts = {
        x: x + halfW,
        y: cursorY,
        w: halfW,
        h: PILL_H,
        side: "right",
        team: home,
        outcome: picked === home.abbr ? "win" : null,
        isFaded: hasPick && picked !== home.abbr,
        tag: picked === home.abbr ? tag : undefined,
        spreadLabel: homeSpread,
        record: game.homeRecord ?? "0-0",
        logo: logos.get(home.logo) ?? null,
      };

      // Fills first for both halves, then borders for both halves - a
      // border stroke is centered on the shared seam, so drawing a half's
      // fill after the other half's border has already run there would
      // paint over part of that stroke (see drawPillHalfFill's comment).
      drawPillHalfFill(ctx, displayFont, awayOpts, (c, midY) => drawGameFooterContent(c, displayFont, awayOpts.x, awayOpts.w, midY, awayOpts.spreadLabel, awayOpts.record));
      drawPillHalfFill(ctx, displayFont, homeOpts, (c, midY) => drawGameFooterContent(c, displayFont, homeOpts.x, homeOpts.w, midY, homeOpts.spreadLabel, homeOpts.record));
      drawPillBordersOutcomeLast(ctx, awayOpts, homeOpts);
      drawTeamHalfBadge(ctx, awayOpts);
      drawTeamHalfBadge(ctx, homeOpts);
    });
    cursorY += h + GAP_Y;
  }

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
