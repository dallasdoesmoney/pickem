import { TEAMS, TeamAbbr } from "@/data/teams";
import { isSuspiciousPick } from "@/data/powerRankings";
import { TeamScheduleRow } from "@/lib/teamSchedule";
import {
  BRAND_LOGO_SRC,
  LOSS_COLOR,
  PILL_FOOTER_H,
  PILL_H,
  PILL_LOGO_AREA_H,
  PILL_W,
  PillHalfOpts,
  PillOutcome,
  Radii,
  WIN_COLOR,
  darken,
  drawBrandFooter,
  drawPillBordersOutcomeLast,
  drawPillHalfFill,
  loadImage,
  resolveDisplayFont,
  roundRectPath,
} from "@/lib/canvasShare";


// Cell dimensions are the shared pill size (see canvasShare.ts) so this
// page's grid can never drift out of sync with the weekly picks page's -
// the only real difference is what goes in the footer band, since there's
// no spread or record yet: a single "WEEK N" label centered across the
// whole pill instead of two per-team stat lines.
const WIDTH = 840;
const CELL_W = PILL_W;
const CELL_H = PILL_H;
const FOOTER_H = PILL_FOOTER_H;
const LOGO_AREA_H = PILL_LOGO_AREA_H;
const GAP_X = 32;
const GAP_Y = 16;
const ROW_H = CELL_H;
const BODY_W = CELL_W * 2 + GAP_X;
const LEFT_X = (WIDTH - BODY_W) / 2;
const PAD_TOP = 40;
const PAD_BOTTOM = 28;

// Same increments used both to size the canvas up front and to actually
// draw - kept as named constants so the two can't drift apart.
const KICKER_BLOCK_H = 25;
const TITLE_BLOCK_H = 64;
const HEADER_H = KICKER_BLOCK_H + TITLE_BLOCK_H;
// Matches STATS_TO_GRID_GAP below the grid, so the grid sits vertically
// centered between the header and the footer instead of hugging the
// title - there was no gap here at all before, just HEADER_H running
// straight into the first row.
const HEADER_TO_GRID_GAP = 32;
const STAT_PILL_W = 240;
const STAT_PILL_H = 92;
const STAT_PILL_GAP = 24;
const STATS_BLOCK_H = STAT_PILL_H + 10 + 26; // pills + gap + diff line
const STATS_TO_GRID_GAP = 32;
const BRAND_FOOTER_H = 14 + 98 + 10;

const SUSPICIOUS_DOG_SRC = "/suspicious-dog.png";

// Exact same brick-stagger pattern as the app-wide SidelineBrew watermark
// (layout.tsx's SVG <pattern>) and the live predictor page's SVG version -
// a 500x500 tile with the logo repeated at five offsets, rotated -45deg -
// just built on canvas instead of SVG since that's what this renderer has.
// Builds an offscreen tile once, then uses it as a repeating fill pattern
// so the rotation only has to transform the fill, not five separate
// drawImage calls per screen-sized area.
function drawTeamLogoBackdrop(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, w: number, h: number) {
  if (!logo) return;
  const tile = document.createElement("canvas");
  tile.width = 500;
  tile.height = 500;
  const tctx = tile.getContext("2d");
  if (!tctx) return;
  const positions: [number, number][] = [
    [140, 140],
    [390, 390],
    [-110, 390],
    [390, -110],
    [-110, -110],
  ];
  for (const [x, y] of positions) tctx.drawImage(logo, x, y, 220, 220);

  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;

  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-45 * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = pattern;
  // Oversized so the rotated fill has no gaps at the canvas's corners.
  const pad = Math.max(w, h);
  ctx.fillRect(-pad, -pad, w + pad * 2, h + pad * 2);
  ctx.restore();
}

// Side-eye dog meme on the corner of the predicted winner's half when the
// pick defies the power rankings - same placement pattern as the weekly
// share image's emoji badges (rotate around the badge's own center, small
// protrusion past the pill edge so it doesn't bleed into the next column).
function drawSuspiciousBadge(ctx: CanvasRenderingContext2D, dog: HTMLImageElement | null, cellX: number, cellY: number, side: "left" | "right") {
  if (!dog) return;
  const badgeH = 44;
  const badgeW = (dog.naturalWidth / dog.naturalHeight) * badgeH;
  const protrusion = 12;
  const centerX = side === "left" ? cellX - protrusion + 19 : cellX + CELL_W + protrusion - 19;
  const centerY = cellY - 8 + 19;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(((side === "left" ? -22 : 22) * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.drawImage(dog, -badgeW / 2, -badgeH / 2, badgeW, badgeH);
  ctx.restore();
}

// One shared label straddling the seam between the two halves, in the
// footer band - stands in for the weekly page's per-team spread/record
// since there's nothing like that to show yet.
function drawWeekLabel(ctx: CanvasRenderingContext2D, displayFont: string, x: number, y: number, w: number, week: number, hasPick: boolean) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `13px ${displayFont}`;
  ctx.fillStyle = hasPick ? "rgba(255,255,255,0.5)" : "#ffffff";
  ctx.fillText(`WEEK ${week}`, x + w / 2, y + LOGO_AREA_H + FOOTER_H / 2 + 1);
}

function drawByeCell(ctx: CanvasRenderingContext2D, displayFont: string, x: number, y: number, w: number, h: number, week: number, logo: HTMLImageElement | null) {
  const r: Radii = { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 };
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `27px ${displayFont}`;
  const label = "BYE WEEK";
  const labelW = ctx.measureText(label).width;
  const logoH = 56;
  const logoW = logo ? (logo.naturalWidth / logo.naturalHeight) * logoH : 0;
  const gap = logo ? 16 : 0;
  const totalW = logoW + gap + labelW;
  const startX = x + w / 2 - totalW / 2;
  const contentMidY = y + LOGO_AREA_H / 2;
  if (logo) ctx.drawImage(logo, startX, contentMidY - logoH / 2, logoW, logoH);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(label, startX + logoW + gap, contentMidY + 1);
  ctx.textAlign = "center";

  ctx.font = `13px ${displayFont}`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`WEEK ${week}`, x + w / 2, y + LOGO_AREA_H + FOOTER_H / 2 + 1);
}

function drawStatPill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  x: number,
  y: number,
  borderColor: string,
  valueColor: string,
  value: string,
  label: string
) {
  const r: Radii = { tl: STAT_PILL_H / 2, tr: STAT_PILL_H / 2, br: STAT_PILL_H / 2, bl: STAT_PILL_H / 2 };
  roundRectPath(ctx, x, y, STAT_PILL_W, STAT_PILL_H, r);
  ctx.fillStyle = "#1b2947";
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `36px ${displayFont}`;
  ctx.fillStyle = valueColor;
  ctx.fillText(value, x + STAT_PILL_W / 2, y + 52);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, x + STAT_PILL_W / 2, y + 74);
}

// Neutral-styled cousin of the record pill: dog image + suspicious-pick
// count. Content-fit width for the same reason as the record pill.
function measureSuspiciousPillWidth(ctx: CanvasRenderingContext2D, displayFont: string, dog: HTMLImageElement | null, value: string, label: string) {
  const padX = 20;
  const dogH = 48;
  const dogW = dog ? (dog.naturalWidth / dog.naturalHeight) * dogH : 0;
  const gap = dog ? 12 : 0;
  ctx.font = `30px ${displayFont}`;
  const valueW = ctx.measureText(value).width;
  ctx.font = "11px system-ui, sans-serif";
  const labelW = ctx.measureText(label).width;
  const textW = Math.max(valueW, labelW);
  return { w: padX * 2 + dogW + gap + textW, padX, dogH, dogW, gap };
}

function drawSuspiciousPill(ctx: CanvasRenderingContext2D, displayFont: string, x: number, y: number, dog: HTMLImageElement | null, value: string, label: string) {
  const { w, padX, dogH, dogW, gap } = measureSuspiciousPillWidth(ctx, displayFont, dog, value, label);
  const h = STAT_PILL_H;
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  ctx.fillStyle = "#1b2947";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  if (dog) ctx.drawImage(dog, x + padX, y + h / 2 - dogH / 2, dogW, dogH);

  const textX = x + padX + dogW + gap;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `30px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(value, textX, y + 48);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, textX, y + 70);
  ctx.textAlign = "center";

  return w;
}

// The record is the headline stat - it gets the team logo, a green
// "this is yours" accent border with a soft glow, and left-aligned text
// instead of centered, so it visually outranks the neutral Vegas pill
// next to it. Width is content-fit (logo + longer of value/label) rather
// than fixed, since the logo makes a fixed width awkward across teams.
function measureRecordPillWidth(ctx: CanvasRenderingContext2D, displayFont: string, logo: HTMLImageElement | null, value: string, label: string) {
  const padX = 20;
  const logoH = 52;
  const logoW = logo ? (logo.naturalWidth / logo.naturalHeight) * logoH : 0;
  const gap = logo ? 14 : 0;
  ctx.font = `36px ${displayFont}`;
  const valueW = ctx.measureText(value).width;
  ctx.font = "11px system-ui, sans-serif";
  const labelW = ctx.measureText(label).width;
  const textW = Math.max(valueW, labelW);
  return { w: padX * 2 + logoW + gap + textW, padX, logoH, logoW, gap };
}

function drawRecordPill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  x: number,
  y: number,
  logo: HTMLImageElement | null,
  value: string,
  label: string
) {
  const { w, padX, logoH, logoW, gap } = measureRecordPillWidth(ctx, displayFont, logo, value, label);
  const h = STAT_PILL_H;
  const r: Radii = { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 };

  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = "#1b2947";
  ctx.fill();
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 3;
  ctx.shadowColor = "rgba(74,222,128,0.4)";
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  if (logo) ctx.drawImage(logo, x + padX, y + h / 2 - logoH / 2, logoW, logoH);

  const textX = x + padX + logoW + gap;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `36px ${displayFont}`;
  ctx.fillStyle = "#4ade80";
  ctx.fillText(value, textX, y + 50);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, textX, y + 72);
  ctx.textAlign = "center";

  return w;
}

export type PredictorShareParams = {
  team: TeamAbbr;
  schedule: TeamScheduleRow[];
  picks: Record<number, TeamAbbr>;
  winTotal?: number;
};

export async function renderPredictorShareImage(params: PredictorShareParams): Promise<Blob> {
  const { team: trackedTeam, schedule, picks, winTotal } = params;
  const team = TEAMS[trackedTeam];

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
  schedule.forEach((row) => {
    if ("away" in row) {
      logoUrls.add(TEAMS[row.away].logo);
      logoUrls.add(TEAMS[row.home].logo);
    }
  });
  const [logoEntries, brandLogo] = await Promise.all([
    Promise.all(Array.from(logoUrls).map(async (url) => [url, await loadImage(url)] as const)),
    loadImage(BRAND_LOGO_SRC),
  ]);
  const suspiciousDog = await loadImage(SUSPICIOUS_DOG_SRC);
  const logos = new Map(logoEntries);
  const teamLogo = logos.get(team.logo) ?? null;

  const wins = Object.values(picks).filter((winner) => winner === trackedTeam).length;
  const losses = Object.values(picks).filter((winner) => winner !== trackedTeam).length;
  const diff = winTotal !== undefined && wins + losses > 0 ? Math.round((wins - winTotal) * 2) / 2 : null;

  const suspiciousCount = schedule.filter((row) => {
    if ("bye" in row) return false;
    const winner = picks[row.week];
    if (!winner) return false;
    return isSuspiciousPick(winner, winner === row.away ? row.home : row.away, winner === row.home);
  }).length;

  const rowCount = Math.ceil(schedule.length / 2);
  const gridH = rowCount * ROW_H + (rowCount - 1) * GAP_Y;
  const totalHeight = PAD_TOP + HEADER_H + HEADER_TO_GRID_GAP + gridH + STATS_TO_GRID_GAP + STATS_BLOCK_H + BRAND_FOOTER_H + PAD_BOTTOM;

  const pixelRatio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * pixelRatio;
  canvas.height = totalHeight * pixelRatio;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.scale(pixelRatio, pixelRatio);

  // Team-tinted background - matches the live page: a solid wash of the
  // team's own color, darkened since it's sitting behind everything.
  // BG_DARKEN_FACTOR is compound: 0.55 was the original darkening pass,
  // then another 30% darker on top (x0.7).
  const BG_DARKEN_FACTOR = 0.55 * 0.7;
  const bgColor = darken(team.color, BG_DARKEN_FACTOR, 1);
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, WIDTH, totalHeight);
  drawTeamLogoBackdrop(ctx, teamLogo, WIDTH, totalHeight);

  // Logo-left, kicker+title stacked right lockup - the logo is sized to the
  // combined header block height and vertically centered against it, rather
  // than sitting inline with just the title's own line height.
  let cursorY = PAD_TOP;
  ctx.textBaseline = "alphabetic";

  const kickerText = "SCHEDULE PREDICTOR";
  const titleText = `${team.city.toUpperCase()} ${team.name.toUpperCase()}`;
  ctx.font = "15px system-ui, sans-serif";
  const kickerW = ctx.measureText(kickerText).width;
  ctx.font = `50px ${displayFont}`;
  const titleW = ctx.measureText(titleText).width;
  const textStackW = Math.max(kickerW, titleW);

  const headerLogoH = 104;
  const headerLogoW = teamLogo ? (teamLogo.naturalWidth / teamLogo.naturalHeight) * headerLogoH : 0;
  const headerLogoGap = teamLogo ? 20 : 0;
  const headerTotalW = headerLogoW + headerLogoGap + textStackW;
  const headerStartX = WIDTH / 2 - headerTotalW / 2;
  const textX = headerStartX + headerLogoW + headerLogoGap;

  // Centered against the text's VISIBLE span, not HEADER_H - the title
  // block reserves space below its baseline that no ink reaches (the
  // header text is all caps, so nothing descends), which made a
  // block-centered logo read as sitting too low.
  const headerInkTop = 4; // kicker cap top (15px font, baseline at +15)
  const headerInkBottom = KICKER_BLOCK_H + 44; // title baseline
  const headerLogoY = cursorY + (headerInkTop + headerInkBottom) / 2 - headerLogoH / 2;
  if (teamLogo) ctx.drawImage(teamLogo, headerStartX, headerLogoY, headerLogoW, headerLogoH);

  ctx.textAlign = "left";
  ctx.font = "15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText(kickerText, textX, cursorY + 15);
  cursorY += KICKER_BLOCK_H;

  ctx.font = `50px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(titleText, textX, cursorY + 44);
  ctx.textAlign = "center";
  cursorY += TITLE_BLOCK_H + HEADER_TO_GRID_GAP;

  schedule.forEach((row, i) => {
    // Column-major, matching the live page: weeks 1..rowCount fill the
    // left column top-to-bottom, then rowCount+1..end fill the right one -
    // not left/right/left/right row-major order.
    const col = Math.floor(i / rowCount);
    const rowIdx = i % rowCount;
    const cellX = LEFT_X + col * (CELL_W + GAP_X);
    const cellY = cursorY + rowIdx * (ROW_H + GAP_Y);

    if ("bye" in row) {
      drawByeCell(ctx, displayFont, cellX, cellY, CELL_W, CELL_H, row.week, teamLogo);
      return;
    }

    const picked = picks[row.week];
    const hasPick = !!picked;
    const halfW = CELL_W / 2;
    const away = TEAMS[row.away];
    const home = TEAMS[row.home];

    function outcomeFor(abbr: TeamAbbr): PillOutcome {
      if (!hasPick || abbr !== trackedTeam) return null;
      return picked === trackedTeam ? "win" : "loss";
    }
    function isFadedFor(abbr: TeamAbbr): boolean {
      return hasPick && abbr !== trackedTeam;
    }

    const awayOpts: PillHalfOpts = {
      x: cellX,
      y: cellY,
      w: halfW,
      h: CELL_H,
      side: "left",
      team: away,
      outcome: outcomeFor(row.away),
      isFaded: isFadedFor(row.away),
      logo: logos.get(away.logo) ?? null,
    };
    const homeOpts: PillHalfOpts = {
      x: cellX + halfW,
      y: cellY,
      w: halfW,
      h: CELL_H,
      side: "right",
      team: home,
      outcome: outcomeFor(row.home),
      isFaded: isFadedFor(row.home),
      logo: logos.get(home.logo) ?? null,
    };

    // Fills for both halves before either border - a border stroke is
    // centered on the shared seam, so drawing a half's fill after the
    // other half's border already ran there paints over part of that
    // stroke (see canvasShare.ts's drawPillHalfFill for the full story).
    drawPillHalfFill(ctx, displayFont, awayOpts);
    drawPillHalfFill(ctx, displayFont, homeOpts);
    drawWeekLabel(ctx, displayFont, cellX, cellY, CELL_W, row.week, hasPick);

    // Whichever half has the outcome (if any) is drawn last, so its
    // colored border always wins the shared seam - see
    // drawPillBordersOutcomeLast's comment for why.
    drawPillBordersOutcomeLast(ctx, awayOpts, homeOpts);

    if (hasPick && isSuspiciousPick(picked, picked === row.away ? row.home : row.away, picked === row.home)) {
      drawSuspiciousBadge(ctx, suspiciousDog, cellX, cellY, picked === row.away ? "left" : "right");
    }
  });

  cursorY += gridH + STATS_TO_GRID_GAP;

  // Bottom KPI row, matching the live page left-to-right: suspicious-pick
  // counter, predicted record (the headline stat - team logo + green
  // accent), Vegas prediction.
  const { w: suspiciousW } = measureSuspiciousPillWidth(ctx, displayFont, suspiciousDog, `${suspiciousCount}`, "SUSPICIOUS PICKS");
  const { w: recordW } = measureRecordPillWidth(ctx, displayFont, teamLogo, `${wins}-${losses}`, "MY PREDICTION");
  const pillsW = suspiciousW + STAT_PILL_GAP + recordW + (winTotal !== undefined ? STAT_PILL_GAP + STAT_PILL_W : 0);
  let pillX = WIDTH / 2 - pillsW / 2;
  drawSuspiciousPill(ctx, displayFont, pillX, cursorY, suspiciousDog, `${suspiciousCount}`, "SUSPICIOUS PICKS");
  pillX += suspiciousW + STAT_PILL_GAP;
  drawRecordPill(ctx, displayFont, pillX, cursorY, teamLogo, `${wins}-${losses}`, "MY PREDICTION");
  pillX += recordW + STAT_PILL_GAP;
  if (winTotal !== undefined) {
    drawStatPill(ctx, displayFont, pillX, cursorY, "#ffffff", "#ffffff", `${winTotal}`, "VEGAS PREDICTION");
  }
  cursorY += STAT_PILL_H + 10;

  if (diff !== null) {
    const overUnder = diff > 0 ? "OVER" : diff < 0 ? "UNDER" : "PUSH";
    const diffColor = diff > 0 ? WIN_COLOR : diff < 0 ? LOSS_COLOR : "#ffffff";
    ctx.font = `20px ${displayFont}`;
    ctx.fillStyle = diffColor;
    ctx.fillText(`${diff > 0 ? "+" : ""}${diff} ${overUnder} Vegas’ line`, WIDTH / 2, cursorY + 18);
  }
  cursorY += 26;

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
