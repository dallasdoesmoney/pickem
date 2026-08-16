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
// Matches the weekly share image's stat pills exactly (drawStatPill in
// shareImage.ts) - same height, same value/label font sizes, same
// icon-as-rotated-corner-tag treatment - per feedback that this page's
// pills read heavier/taller than the weekly page's for no real reason
// once the two-line labels became one line.
const STAT_PILL_H = 88;
const STAT_PILL_GAP = 24;
const STATS_BLOCK_H = STAT_PILL_H + 10 + 26; // pills + gap + diff line
const STATS_TO_GRID_GAP = 32;
const BRAND_FOOTER_H = 12 + 104 + 10 + 18 + 10;

const SUSPICIOUS_DOG_SRC = "/suspicious-dog.png";

// The team logo asset is a 500x500 raster (see espnLogo() in teams.ts) -
// fine at pill size, but stretching it to a thousand-plus px for this
// backdrop upscales it ~4-5x and reads as blurry. ESPN's combiner
// endpoint re-renders the same mark at a much higher resolution instead
// of just scaling the small PNG, so the backdrop stays crisp.
function hiResLogoUrl(url: string): string {
  const path = url.replace("https://a.espncdn.com", "");
  return `https://a.espncdn.com/combiner/i?img=${path}&w=2000&h=2000`;
}

// Matches the live predictor page's background: one huge team logo
// bleeding off the left edge at low opacity, not the old repeating-logo
// watermark pattern (that's the app-wide SidelineBrew chrome in
// layout.tsx, used elsewhere - this page replaced its own copy of it with
// a single giant logo per feedback that the pattern read as "busy").
// Sized big and left-heavy on purpose - bled off the canvas's left edge -
// starting just below the header so it never crosses into the title
// text, then running big down through the grid. Values picked from a
// five-way placement comparison (sizeMult/xFrac/yOffset all tunable if
// this needs revisiting).
function drawGiantLogoBackdrop(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null, gridStartY: number, gridH: number) {
  if (!logo) return;
  const logoH = gridH * 1.275;
  const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
  const x = -logoW * 0.48;
  const y = gridStartY - 50;
  ctx.save();
  ctx.globalAlpha = 0.17;
  ctx.drawImage(logo, x, y, logoW, logoH);
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

// Same rotated-corner-tag treatment as the weekly share image's emoji
// badges (drawStatPill's badgeEmoji in shareImage.ts) - just an image
// instead of a text glyph, for the suspicious-dog and team-logo tags.
function drawPillTag(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, pillX: number, pillY: number) {
  if (!img) return;
  const h = 50;
  const w = (img.naturalWidth / img.naturalHeight) * h;
  ctx.save();
  ctx.translate(pillX + 10, pillY + 2);
  ctx.rotate((-18 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.shadowBlur = 0;
  ctx.restore();
}

// Matches the weekly share image's stat pills (same height, centered
// text) now that the icon moved from inline content to a corner tag.
// Label font/gap are fixed; valueFont varies per pill (the record pill's
// is bigger) - always pass through drawPillStackedText below so the
// value+label block re-centers as a unit no matter how big the value
// font is, instead of the fixed 0.42h/0.8h fractions this used to use,
// which only centered correctly for one specific font size and let
// bigger value text creep up into the pill's top border.
const PILL_LABEL_FONT_PX = 14;
const PILL_LINE_GAP = 8;

function measurePillContentWidth(ctx: CanvasRenderingContext2D, displayFont: string, value: string, label: string, padX: number, valueFont = 32) {
  ctx.font = `${valueFont}px ${displayFont}`;
  const valueW = ctx.measureText(value).width;
  ctx.font = `${PILL_LABEL_FONT_PX}px system-ui, sans-serif`;
  const labelW = ctx.measureText(label).width;
  return Math.max(valueW, labelW) + padX * 2;
}

function drawPillStackedText(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  cx: number,
  y: number,
  h: number,
  valueFont: number,
  value: string,
  valueColor: string,
  label: string,
  labelColor: string
) {
  const stackH = valueFont + PILL_LINE_GAP + PILL_LABEL_FONT_PX;
  const stackTop = y + (h - stackH) / 2;
  const valueCenterY = stackTop + valueFont / 2;
  const labelCenterY = stackTop + valueFont + PILL_LINE_GAP + PILL_LABEL_FONT_PX / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${valueFont}px ${displayFont}`;
  ctx.fillStyle = valueColor;
  ctx.fillText(value, cx, valueCenterY);
  ctx.font = `${PILL_LABEL_FONT_PX}px system-ui, sans-serif`;
  ctx.fillStyle = labelColor;
  ctx.fillText(label, cx, labelCenterY);
}

function drawNeutralPill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  x: number,
  y: number,
  w: number,
  borderColor: string,
  valueColor: string,
  value: string,
  label: string,
  tag?: HTMLImageElement | null
) {
  const h = STAT_PILL_H;
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawPillStackedText(ctx, displayFont, x + w / 2, y, h, 32, value, valueColor, label, "rgba(255,255,255,0.55)");

  if (tag) drawPillTag(ctx, tag, x, y);
}

// The record is the headline stat - it keeps the team's own color as its
// fill (same as a game pill) so it visually outranks the neutral
// Suspicious/Vegas pills next to it, and its value text runs bigger
// (44px vs the other two's 32px) so it reads as the focal number, not
// just a wider pill.
const RECORD_VALUE_FONT_PX = 44;

function drawRecordPill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  x: number,
  y: number,
  w: number,
  logo: HTMLImageElement | null,
  teamColor: string,
  value: string,
  label: string
) {
  const h = STAT_PILL_H;
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  ctx.fillStyle = teamColor;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawPillStackedText(ctx, displayFont, x + w / 2, y, h, RECORD_VALUE_FONT_PX, value, "#ffffff", label, "rgba(255,255,255,0.75)");

  drawPillTag(ctx, logo, x, y);
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
  const [logoEntries, brandLogo, hiResTeamLogo] = await Promise.all([
    Promise.all(Array.from(logoUrls).map(async (url) => [url, await loadImage(url)] as const)),
    loadImage(BRAND_LOGO_SRC),
    loadImage(hiResLogoUrl(team.logo)),
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
  // Stats block now sits between the header and the grid (matching the
  // weekly share image's layout), with just one GAP_Y - the same trailing
  // gap the weekly page's row loop bakes in before its footer - between
  // the last schedule row and the brand footer.
  const totalHeight = PAD_TOP + HEADER_H + HEADER_TO_GRID_GAP + STATS_BLOCK_H + STATS_TO_GRID_GAP + gridH + GAP_Y + BRAND_FOOTER_H + PAD_BOTTOM;

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
  drawGiantLogoBackdrop(ctx, hiResTeamLogo, PAD_TOP + HEADER_H + HEADER_TO_GRID_GAP, gridH);

  // Logo-left, kicker+title stacked right lockup - the logo is sized to the
  // combined header block height and vertically centered against it, rather
  // than sitting inline with just the title's own line height.
  let cursorY = PAD_TOP;
  ctx.textBaseline = "alphabetic";

  const kickerText = "RECORD PREDICTOR";
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

  // KPI row, matching the weekly share image's layout: stat pills sit
  // above the matchups, not below them - suspicious-pick counter,
  // predicted record (the headline stat - team color + accent), Vegas
  // prediction, left to right.
  const suspiciousLabel = "SUSPICIOUS PICKS";
  const vegasLabel = "VEGAS PREDICTION";
  const bookendW = Math.max(
    measurePillContentWidth(ctx, displayFont, `${suspiciousCount}`, suspiciousLabel, 24),
    winTotal !== undefined ? measurePillContentWidth(ctx, displayFont, `${winTotal}`, vegasLabel, 24) : 0
  );
  // Guaranteed wider than the bookend pills (not just content-fit) so it
  // reads as the most prominent of the three regardless of how short its
  // own value/label happen to measure.
  const recordW = Math.max(
    measurePillContentWidth(ctx, displayFont, `${wins}-${losses}`, "MY PREDICTION", 30, RECORD_VALUE_FONT_PX),
    bookendW * 1.25
  );
  const pillsW = bookendW + STAT_PILL_GAP + recordW + (winTotal !== undefined ? STAT_PILL_GAP + bookendW : 0);
  let pillX = WIDTH / 2 - pillsW / 2;
  drawNeutralPill(ctx, displayFont, pillX, cursorY, bookendW, "#ffffff", "#ffffff", `${suspiciousCount}`, suspiciousLabel, suspiciousDog);
  pillX += bookendW + STAT_PILL_GAP;
  drawRecordPill(ctx, displayFont, pillX, cursorY, recordW, teamLogo, team.color, `${wins}-${losses}`, "MY PREDICTION");
  pillX += recordW + STAT_PILL_GAP;
  if (winTotal !== undefined) {
    drawNeutralPill(ctx, displayFont, pillX, cursorY, bookendW, "#ffffff", "#ffffff", `${winTotal}`, vegasLabel);
  }
  cursorY += STAT_PILL_H + 10;

  if (diff !== null) {
    const overUnder = diff > 0 ? "OVER" : diff < 0 ? "UNDER" : "PUSH";
    const diffColor = diff > 0 ? WIN_COLOR : diff < 0 ? LOSS_COLOR : "#ffffff";
    ctx.font = `20px ${displayFont}`;
    ctx.fillStyle = diffColor;
    ctx.fillText(`${diff > 0 ? "+" : ""}${diff} ${overUnder} Vegas’ line`, WIDTH / 2, cursorY + 18);
  }
  cursorY += 26 + STATS_TO_GRID_GAP;

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

  // Same trailing gap the weekly share image's row loop bakes in before
  // its footer (GAP_Y, 16px) - drawBrandFooter adds its own top padding
  // on top of this, matching that page's total gap exactly.
  cursorY += gridH + GAP_Y;

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
