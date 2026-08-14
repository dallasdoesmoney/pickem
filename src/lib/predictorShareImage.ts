import { TEAMS, TeamAbbr } from "@/data/teams";
import { TeamScheduleRow } from "@/lib/teamSchedule";
import { BRAND_LOGO_SRC, Radii, darken, drawBrandFooter, loadImage, resolveDisplayFont, roundRectPath } from "@/lib/canvasShare";

// Cell dimensions match the weekly picks page's GameCard pill exactly
// (343x80, 26px footer band) so the two pages feel like one product -
// the only real difference is what goes in that footer band, since
// there's no spread or record yet: a single "WEEK N" label centered
// across the whole pill instead of two per-team stat lines.
const WIDTH = 840;
const CELL_W = 343;
const CELL_H = 80;
const FOOTER_H = 26;
const LOGO_AREA_H = CELL_H - FOOTER_H;
const GAP_X = 32;
const GAP_Y = 16;
const ROW_H = CELL_H;
const BODY_W = CELL_W * 2 + GAP_X;
const LEFT_X = (WIDTH - BODY_W) / 2;
const PAD_TOP = 40;
const PAD_BOTTOM = 28;
const BG = "#0e1b33";

const BORDER_WIDTH = 4;
const OUTCOME_BORDER_WIDTH = 5;
const WIN_COLOR = "#64e066";
const WIN_COLOR_RGB = "100,224,102";
const LOSS_COLOR = "#ef4444";
const LOSS_COLOR_RGB = "239,68,68";

// Same increments used both to size the canvas up front and to actually
// draw - kept as named constants so the two can't drift apart.
const KICKER_BLOCK_H = 25;
const TITLE_BLOCK_H = 64;
const HEADER_H = KICKER_BLOCK_H + TITLE_BLOCK_H;
const STAT_PILL_W = 240;
const STAT_PILL_H = 92;
const STAT_PILL_GAP = 24;
const STATS_BLOCK_H = STAT_PILL_H + 10 + 26; // pills + gap + diff line
const STATS_TO_GRID_GAP = 32;
const BRAND_FOOTER_H = 14 + 132 + 10;

type Outcome = "win" | "loss" | null;

function drawSeasonHalfFill(
  ctx: CanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    side: "left" | "right";
    team: (typeof TEAMS)[TeamAbbr];
    outcome: Outcome;
    isFaded: boolean;
    logo: HTMLImageElement | null;
  }
) {
  const { x, y, w, h, side, team, outcome, isFaded, logo } = opts;
  const radius = h / 2;
  const r: Radii = side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();

  ctx.fillStyle = team.color;
  ctx.fillRect(x, y, w, h);

  if (logo) {
    const logoH = 117;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, x + w / 2 - logoW / 2, y + LOGO_AREA_H / 2 - logoH / 2, logoW, logoH);
  }

  ctx.fillStyle = darken(team.color, 0.6, 0.93);
  ctx.fillRect(x, y + LOGO_AREA_H, w, FOOTER_H);

  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;
  const outcomeRgb = outcome === "win" ? WIN_COLOR_RGB : outcome === "loss" ? LOSS_COLOR_RGB : null;

  if (outcomeColor) {
    ctx.fillStyle = `rgba(${outcomeRgb},0.16)`;
    ctx.fillRect(x, y, w, h);
  }

  // Same proven-reliable dimming trick as the weekly share image: a plain
  // translucent overlay instead of ctx.filter, which silently no-ops on at
  // least one real device this app ships to.
  if (isFaded) {
    ctx.fillStyle = "rgba(6,10,20,0.6)";
    ctx.fillRect(x, y, w, h);
  }

  ctx.restore();
}

function drawSeasonHalfLetter(ctx: CanvasRenderingContext2D, displayFont: string, opts: { x: number; y: number; w: number; h: number; outcome: Outcome }) {
  const { x, y, w, h, outcome } = opts;
  if (!outcome) return;
  const outcomeColor = outcome === "win" ? WIN_COLOR : LOSS_COLOR;
  ctx.save();
  // Confined to the logo area only (not the full half height) so it never
  // bleeds into the footer band and collides with the shared week label.
  ctx.translate(x + w / 2, y + LOGO_AREA_H / 2);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `60px ${displayFont}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText(outcome === "win" ? "W" : "L", 0, 4);
  ctx.fillStyle = outcomeColor;
  ctx.fillText(outcome === "win" ? "W" : "L", 0, 4);
  ctx.restore();
}

function drawSeasonHalfBorder(
  ctx: CanvasRenderingContext2D,
  opts: { x: number; y: number; w: number; h: number; side: "left" | "right"; outcome: Outcome; isFaded: boolean }
) {
  const { x, y, w, h, side, outcome, isFaded } = opts;
  const radius = h / 2;
  const r: Radii = side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };
  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;
  // Faded halves get a translucent border to match their dimmed fill -
  // an opaque one would look like it never dimmed at all, and (since
  // border strokes are centered on the shared seam between the two
  // halves) would risk painting over the tracked team's colored border
  // there even when drawn first.
  const borderColor = outcomeColor ?? (isFaded ? "rgba(255,255,255,0.35)" : "#ffffff");

  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = outcomeColor ? OUTCOME_BORDER_WIDTH : BORDER_WIDTH;
  ctx.strokeStyle = borderColor;
  if (outcomeColor) {
    ctx.shadowColor = `rgba(${outcome === "win" ? WIN_COLOR_RGB : LOSS_COLOR_RGB},0.6)`;
    ctx.shadowBlur = 6;
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

// One shared label straddling the seam between the two halves, in the
// footer band - stands in for the weekly page's per-team spread/record
// since there's nothing like that to show yet.
function drawWeekLabel(ctx: CanvasRenderingContext2D, displayFont: string, x: number, y: number, w: number, week: number) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `13px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 3;
  ctx.fillText(`WEEK ${week}`, x + w / 2, y + LOGO_AREA_H + FOOTER_H / 2 + 1);
  ctx.shadowBlur = 0;
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
  ctx.font = `20px ${displayFont}`;
  const label = "BYE WEEK";
  const labelW = ctx.measureText(label).width;
  const logoH = 40;
  const logoW = logo ? (logo.naturalWidth / logo.naturalHeight) * logoH : 0;
  const gap = logo ? 12 : 0;
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
  const logos = new Map(logoEntries);
  const teamLogo = logos.get(team.logo) ?? null;

  const wins = Object.values(picks).filter((winner) => winner === trackedTeam).length;
  const losses = Object.values(picks).filter((winner) => winner !== trackedTeam).length;
  const diff = winTotal !== undefined && wins + losses > 0 ? Math.round((wins - winTotal) * 2) / 2 : null;

  const rowCount = Math.ceil(schedule.length / 2);
  const gridH = rowCount * ROW_H + (rowCount - 1) * GAP_Y;
  const totalHeight = PAD_TOP + HEADER_H + gridH + STATS_TO_GRID_GAP + STATS_BLOCK_H + BRAND_FOOTER_H + PAD_BOTTOM;

  const pixelRatio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * pixelRatio;
  canvas.height = totalHeight * pixelRatio;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.scale(pixelRatio, pixelRatio);

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, WIDTH, totalHeight);

  // Huge, faded team-logo watermark bleeding off the left edge, behind the
  // header text - mirrors the live page's header treatment so it's clear
  // at a glance whose schedule this is, even in a cropped share preview.
  if (teamLogo) {
    ctx.save();
    ctx.globalAlpha = 0.14;
    const bgLogoH = 320;
    const bgLogoW = (teamLogo.naturalWidth / teamLogo.naturalHeight) * bgLogoH;
    ctx.drawImage(teamLogo, -40, PAD_TOP - 60, bgLogoW, bgLogoH);
    ctx.restore();
  }

  let cursorY = PAD_TOP;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  ctx.font = "15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("SCHEDULE PREDICTOR", WIDTH / 2, cursorY + 15);
  cursorY += KICKER_BLOCK_H;

  ctx.font = `50px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`${team.city.toUpperCase()} ${team.name.toUpperCase()}`, WIDTH / 2, cursorY + 44);
  cursorY += TITLE_BLOCK_H;

  schedule.forEach((row, i) => {
    const rowIdx = Math.floor(i / 2);
    const col = i % 2;
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

    function outcomeFor(abbr: TeamAbbr): Outcome {
      if (!hasPick || abbr !== trackedTeam) return null;
      return picked === trackedTeam ? "win" : "loss";
    }
    function isFadedFor(abbr: TeamAbbr): boolean {
      return hasPick && abbr !== trackedTeam;
    }

    const awayOpts = {
      x: cellX,
      y: cellY,
      w: halfW,
      h: CELL_H,
      side: "left" as const,
      team: away,
      outcome: outcomeFor(row.away),
      isFaded: isFadedFor(row.away),
      logo: logos.get(away.logo) ?? null,
    };
    const homeOpts = {
      x: cellX + halfW,
      y: cellY,
      w: halfW,
      h: CELL_H,
      side: "right" as const,
      team: home,
      outcome: outcomeFor(row.home),
      isFaded: isFadedFor(row.home),
      logo: logos.get(home.logo) ?? null,
    };

    // Fills for both halves before either border - a border stroke is
    // centered on the shared seam, so drawing a half's fill after the
    // other half's border already ran there paints over part of that
    // stroke (see shareImage.ts's drawTeamHalfFill for the full story).
    drawSeasonHalfFill(ctx, awayOpts);
    drawSeasonHalfFill(ctx, homeOpts);
    drawSeasonHalfLetter(ctx, displayFont, awayOpts);
    drawSeasonHalfLetter(ctx, displayFont, homeOpts);
    drawWeekLabel(ctx, displayFont, cellX, cellY, CELL_W, row.week);

    // The tracked team's border is drawn LAST regardless of which side
    // it's on, so its color always wins the shared seam even against the
    // opponent's own (now-translucent-when-faded, but still a live
    // stroke) border - whichever border is stroked second wins the
    // pixels they both cover at that boundary.
    const trackedIsAway = row.away === trackedTeam;
    if (trackedIsAway) {
      drawSeasonHalfBorder(ctx, homeOpts);
      drawSeasonHalfBorder(ctx, awayOpts);
    } else {
      drawSeasonHalfBorder(ctx, awayOpts);
      drawSeasonHalfBorder(ctx, homeOpts);
    }
  });

  cursorY += gridH + STATS_TO_GRID_GAP;

  // Predicted record + Vegas prediction pills, back at the bottom to match
  // the live page. The record pill carries the team logo and a green
  // "this is yours" accent so it's unmistakably the headline stat when
  // someone else is looking at the image cold.
  ctx.font = `36px ${displayFont}`;
  const { w: recordW } = measureRecordPillWidth(ctx, displayFont, teamLogo, `${wins}-${losses}`, "MY PREDICTION");
  const pillsW = winTotal !== undefined ? recordW + STAT_PILL_GAP + STAT_PILL_W : recordW;
  let pillX = WIDTH / 2 - pillsW / 2;
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
