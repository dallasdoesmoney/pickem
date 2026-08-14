import { TEAMS, TeamAbbr } from "@/data/teams";
import { TeamScheduleRow } from "@/lib/teamSchedule";
import { BRAND_LOGO_SRC, Radii, drawBrandFooter, loadImage, resolveDisplayFont, roundRectPath } from "@/lib/canvasShare";

const WIDTH = 840;
const CELL_W = 360;
const CELL_H = 74;
const GAP_X = 32;
const GAP_Y = 16;
const LABEL_H = 24;
const LABEL_GAP = 6;
const ROW_H = LABEL_H + LABEL_GAP + CELL_H;
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
const SUBTITLE_BLOCK_H = 44;
const HEADER_H = KICKER_BLOCK_H + TITLE_BLOCK_H + SUBTITLE_BLOCK_H;
const STAT_PILL_W = 240;
const STAT_PILL_H = 92;
const STAT_PILL_GAP = 24;
const STATS_BLOCK_H = STAT_PILL_H + 10 + 26; // pills + gap + diff line
const STATS_TO_GRID_GAP = 32;
const BRAND_FOOTER_H = 14 + 88 + 10;

type Outcome = "win" | "loss" | null;

function drawSeasonHalfFill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
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
    const logoH = 106;
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, x + w / 2 - logoW / 2, y + h / 2 - logoH / 2, logoW, logoH);
  }

  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;
  const outcomeRgb = outcome === "win" ? WIN_COLOR_RGB : outcome === "loss" ? LOSS_COLOR_RGB : null;

  if (outcomeColor) {
    ctx.fillStyle = `rgba(${outcomeRgb},0.16)`;
    ctx.fillRect(x, y, w, h);

    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `50px ${displayFont}`;
    ctx.lineJoin = "round";
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#ffffff";
    ctx.strokeText(outcome === "win" ? "W" : "L", 0, 3);
    ctx.fillStyle = outcomeColor;
    ctx.fillText(outcome === "win" ? "W" : "L", 0, 3);
    ctx.restore();
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

function drawByeCell(ctx: CanvasRenderingContext2D, displayFont: string, x: number, y: number, w: number, h: number, logo: HTMLImageElement | null) {
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
  if (logo) ctx.drawImage(logo, startX, y + h / 2 - logoH / 2, logoW, logoH);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left";
  ctx.fillText(label, startX + logoW + gap, y + h / 2 + 1);
  ctx.textAlign = "center";
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

  const wins = Object.values(picks).filter((winner) => winner === trackedTeam).length;
  const losses = Object.values(picks).filter((winner) => winner !== trackedTeam).length;
  const diff = winTotal !== undefined && wins + losses > 0 ? Math.round((wins - winTotal) * 2) / 2 : null;

  const rowCount = Math.ceil(schedule.length / 2);
  const gridH = rowCount * ROW_H + (rowCount - 1) * GAP_Y;
  const totalHeight = PAD_TOP + HEADER_H + STATS_BLOCK_H + STATS_TO_GRID_GAP + gridH + BRAND_FOOTER_H + PAD_BOTTOM;

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

  ctx.font = "15px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("PRE-SEASON", WIDTH / 2, cursorY + 15);
  cursorY += KICKER_BLOCK_H;

  ctx.font = `50px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("SCHEDULE PREDICTOR", WIDTH / 2, cursorY + 44);
  cursorY += TITLE_BLOCK_H;

  const teamLogo = logos.get(team.logo) ?? null;
  ctx.font = "16px system-ui, sans-serif";
  const subtitle = `${team.name}’ full 2026 schedule`;
  const subtitleW = ctx.measureText(subtitle).width;
  const subLogoH = 26;
  const subLogoW = teamLogo ? (teamLogo.naturalWidth / teamLogo.naturalHeight) * subLogoH : 0;
  const subGap = teamLogo ? 10 : 0;
  const subTotalW = subLogoW + subGap + subtitleW;
  const subStartX = WIDTH / 2 - subTotalW / 2;
  if (teamLogo) ctx.drawImage(teamLogo, subStartX, cursorY, subLogoW, subLogoH);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(subtitle, subStartX + subLogoW + subGap, cursorY + 19);
  ctx.textAlign = "center";
  cursorY += SUBTITLE_BLOCK_H;

  // Predicted record + Vegas prediction pills, kept at the top of the
  // shared image even though they sit at the bottom of the live page -
  // same reasoning as the weekly picks page's KPI row: makes more sense
  // up front when someone else is looking at the image cold.
  const pillsW = winTotal !== undefined ? STAT_PILL_W * 2 + STAT_PILL_GAP : STAT_PILL_W;
  const pillsX = WIDTH / 2 - pillsW / 2;
  drawStatPill(ctx, displayFont, pillsX, cursorY, "#ffffff", "#ffffff", `${wins}-${losses}`, "PREDICTED RECORD");
  if (winTotal !== undefined) {
    drawStatPill(ctx, displayFont, pillsX + STAT_PILL_W + STAT_PILL_GAP, cursorY, "#4ade80", "#4ade80", `${winTotal}`, "VEGAS PREDICTION");
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
    const rowIdx = Math.floor(i / 2);
    const col = i % 2;
    const cellX = LEFT_X + col * (CELL_W + GAP_X);
    const cellTopY = cursorY + rowIdx * (ROW_H + GAP_Y);

    ctx.font = `13px ${displayFont}`;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`WEEK ${row.week}`, cellX + CELL_W / 2, cellTopY + LABEL_H - 8);

    const pillY = cellTopY + LABEL_H + LABEL_GAP;

    if ("bye" in row) {
      drawByeCell(ctx, displayFont, cellX, pillY, CELL_W, CELL_H, teamLogo);
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
      y: pillY,
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
      y: pillY,
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
    drawSeasonHalfFill(ctx, displayFont, awayOpts);
    drawSeasonHalfFill(ctx, displayFont, homeOpts);

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

  cursorY += gridH;

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
