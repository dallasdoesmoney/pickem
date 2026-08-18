import { Game } from "@/data/games";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { BOLDEST_PICK_ICON, DesktopRow, PickStats, PickTag, UNDERDOG_ICON, buildDesktopRows, computePickStats, computePickTags } from "@/lib/pickLayout";
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
  badgeIcon?: HTMLImageElement | null,
  // Boldest Pick moved into a narrower pill than it used to have (the old
  // Chalk slot), which left its logo+text value crowding the corner badge
  // - narrower pills pass a smaller logo so there's room for both.
  logoH = 66,
  // Boldest Pick's "+N.N" reads oversized next to its now-smaller logo,
  // compared to how Underdogs/Lock look - lets that one pill turn it down
  // without affecting the other two.
  valueFontPx = 32,
  // Lock of the Week's badge - see badgeIcon draw below, this pill leans
  // into being an oversized "pin" instead of trying to tuck neatly into
  // the corner.
  badgeSize = 46,
  // Lock of the Week only - the locked team's own color, matching the
  // live UI's pill background once a lock is set. Undefined for the
  // other two pills, which stay flat/transparent over the canvas bg.
  fillColor?: string
) {
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.fillStyle = valueColor;
  ctx.font = `${valueFontPx}px ${displayFont}`;
  const valueY = y + h * 0.42;

  if (logo && value) {
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    const valueWidth = ctx.measureText(value).width;
    const totalW = logoW + 8 + valueWidth;
    const startX = x + w / 2 - totalW / 2;
    ctx.drawImage(logo, startX, valueY - logoH * 0.72, logoW, logoH);
    ctx.textAlign = "left";
    ctx.fillText(value, startX + logoW + 8, valueY);
    ctx.textAlign = "center";
  } else if (logo) {
    const logoW = (logo.naturalWidth / logo.naturalHeight) * logoH;
    ctx.drawImage(logo, x + w / 2 - logoW / 2, valueY - logoH * 0.72, logoW, logoH);
  } else {
    ctx.fillText(value, x + w / 2, valueY);
  }

  ctx.font = "14px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, x + w / 2, y + h * 0.8);

  if (badgeIcon) {
    // Capped by whichever dimension is larger (all three current badge
    // icons are taller than wide, so this caps height today, but stays
    // correct if a future icon is landscape instead).
    const aspect = badgeIcon.naturalWidth / badgeIcon.naturalHeight;
    const badgeW = aspect >= 1 ? badgeSize : badgeSize * aspect;
    const badgeH = aspect >= 1 ? badgeSize / aspect : badgeSize;
    ctx.save();
    ctx.translate(x + 6, y - 4);
    ctx.rotate((-18 * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 4;
    ctx.drawImage(badgeIcon, -badgeW / 2, -badgeH / 2, badgeW, badgeH);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// Same stacked-text centering + rotated corner-tag pattern already proven
// on the predictor's share image (its own copy, kept separate rather than
// shared - small, stable, self-contained, low risk either way).
const PILL_LABEL_FONT_PX = 14;
const PILL_LINE_GAP = 8;

function drawPillStackedText(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  cx: number,
  y: number,
  h: number,
  valueFontPx: number,
  value: string,
  valueColor: string,
  label: string,
  labelColor: string
) {
  const stackH = valueFontPx + PILL_LINE_GAP + PILL_LABEL_FONT_PX;
  const stackTop = y + (h - stackH) / 2;
  const valueCenterY = stackTop + valueFontPx / 2;
  const labelCenterY = stackTop + valueFontPx + PILL_LINE_GAP + PILL_LABEL_FONT_PX / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${valueFontPx}px ${displayFont}`;
  ctx.fillStyle = valueColor;
  ctx.fillText(value, cx, valueCenterY);
  ctx.font = `${PILL_LABEL_FONT_PX}px system-ui, sans-serif`;
  ctx.fillStyle = labelColor;
  ctx.fillText(label, cx, labelCenterY);
}

function drawPillImageTag(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, pillX: number, pillY: number) {
  if (!img) return;
  const h = 50;
  const w = (img.naturalWidth / img.naturalHeight) * h;
  ctx.save();
  ctx.translate(pillX + 10, pillY + 2);
  ctx.rotate((-18 * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  // Avatars are usually square already, but a circular clip keeps a
  // non-square upload from looking wrong sitting next to team logos.
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, h / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  ctx.shadowBlur = 0;
  ctx.restore();
}

// The results record pill - filled (not just bordered) so it outranks
// whatever else is on the row, with the avatar as a rotated corner tag
// mirroring the team predictor's "My Prediction" pill treatment.
function drawResultsRecordPill(
  ctx: CanvasRenderingContext2D,
  displayFont: string,
  x: number,
  y: number,
  w: number,
  h: number,
  value: string,
  avatar: HTMLImageElement | null
) {
  roundRectPath(ctx, x, y, w, h, { tl: h / 2, tr: h / 2, br: h / 2, bl: h / 2 });
  ctx.fillStyle = "#22c55e";
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  drawPillStackedText(ctx, displayFont, x + w / 2, y, h, 44, value, "#ffffff", "MY RECORD", "rgba(255,255,255,0.8)");

  drawPillImageTag(ctx, avatar, x, y);
}

// Canvas counterpart to the live grid's per-game tab (see weekly/page.tsx's
// renderGridGame) - a small rounded-top label tucked behind the pill. Drawn
// BEFORE the pill halves, same trick as the DOM version: whatever paints
// later wins the overlapping pixels, so the pill's opaque fill naturally
// covers the tab's lower portion without any clipping math.
const TAB_VISIBLE_H = 30;
const TAB_TUCK_H = 16;
const TAB_FONT_PX = 15;

function drawGameTab(ctx: CanvasRenderingContext2D, displayFont: string, label: string, centerX: number, pillTopY: number) {
  ctx.font = `${TAB_FONT_PX}px ${displayFont}`;
  const textW = ctx.measureText(label).width;
  const padX = 16;
  const w = textW + padX * 2;
  const h = TAB_VISIBLE_H + TAB_TUCK_H;
  const x = centerX - w / 2;
  const y = pillTopY - TAB_VISIBLE_H;

  roundRectPath(ctx, x, y, w, h, { tl: 12, tr: 12, br: 0, bl: 0 });
  ctx.fillStyle = "#1b2947";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillText(label, centerX, y + TAB_VISIBLE_H / 2);
}

type TeamHalfOpts = PillHalfOpts & {
  tag?: PickTag;
  spreadLabel?: string;
  record: string;
  isLockPick?: boolean;
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

function drawTeamHalfBadge(ctx: CanvasRenderingContext2D, opts: TeamHalfOpts, icon: HTMLImageElement | null | undefined) {
  const { x, y, w, side } = opts;
  if (!icon) return;
  // CSS rotates the badge around its own center by default; rotating
  // around a corner (as this used to) swings it visibly off-target. Only
  // let it protrude ~12px past the pill edge - GAP_X between columns is
  // 32px, and a wider protrusion bleeds into the neighboring pill.
  const protrusion = 12;
  const badgeH = 46; // matches the live UI's TagBadge, sized 20% larger than the original 38/42px
  const half = badgeH / 2;
  const centerX = side === "left" ? x - protrusion + half : x + w + protrusion - half;
  const centerY = y - 8 + half;
  const badgeW = (icon.naturalWidth / icon.naturalHeight) * badgeH;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(((side === "left" ? -22 : 22) * Math.PI) / 180);
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;
  ctx.drawImage(icon, -badgeW / 2, -badgeH / 2, badgeW, badgeH);
  ctx.restore();
}

// Bottom corner (drawTeamHalfBadge above owns the top corner), mirroring
// the live app's LockBadge - ghost/dim when this pick isn't the lock,
// full opacity with a green glow when it is.
// Canvas counterpart to TeamHalfPill's showLockTreatment - full gold
// wash + "LOCK" stamp + gold ring, only pre-results (once a result comes
// in, drawPillHalfFill's own win/loss tint+letter takes over instead).
// Drawn as a separate overlay pass rather than teaching the shared
// drawPillHalfBorder (canvasShare.ts, also used by the season predictor,
// which has no lock concept) about lock state - this must run AFTER
// drawPillBordersOutcomeLast so the gold ring wins over the plain white
// border underneath it.
function drawLockFill(ctx: CanvasRenderingContext2D, displayFont: string, opts: TeamHalfOpts) {
  const { x, y, w, h, side, outcome, isLockPick } = opts;
  if (!isLockPick || outcome) return;
  const radius = h / 2;
  const r: Radii = side === "left" ? { tl: radius, bl: radius, tr: 0, br: 0 } : { tr: radius, br: radius, tl: 0, bl: 0 };

  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.fillStyle = "rgba(245,158,11,0.38)";
  ctx.fillRect(x, y, w, h);

  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `30px ${displayFont}`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.strokeText("LOCK", 0, 4);
  ctx.fillStyle = "#f59e0b";
  ctx.fillText("LOCK", 0, 4);
  ctx.restore();

  roundRectPath(ctx, x, y, w, h, r);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#f59e0b";
  ctx.shadowColor = "rgba(245,158,11,0.6)";
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawLockBadge(ctx: CanvasRenderingContext2D, opts: TeamHalfOpts, icon: HTMLImageElement | null | undefined) {
  const { x, y, w, h, side, isLockPick } = opts;
  if (!icon) return;
  const protrusion = 12;
  const centerX = side === "left" ? x - protrusion + 19 : x + w + protrusion - 19;
  const centerY = y + h + 8 - 19;
  const badgeH = 34;
  const badgeW = (icon.naturalWidth / icon.naturalHeight) * badgeH;
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(((side === "left" ? -18 : 18) * Math.PI) / 180);
  if (isLockPick) {
    ctx.shadowColor = "rgba(245,158,11,0.9)";
    ctx.shadowBlur = 9;
  } else {
    ctx.filter = "grayscale(1)";
    ctx.globalAlpha = 0.45;
  }
  ctx.drawImage(icon, -badgeW / 2, -badgeH / 2, badgeW, badgeH);
  ctx.restore();
}

const BRAND_FOOTER_H = 12 + 104 + 10 + 18 + 10;

// Header/stat-row/body block heights, named once and reused for both the
// canvas-height calculation and the actual draw pass below - keeping them
// as one source of truth instead of two hand-synced numbers.
const HEADER_EYEBROW_PX = 15;
const HEADER_EYEBROW_GAP = 16;
const HEADER_TITLE_PX = 66;
const HEADER_TITLE_GAP = 8;
const HEADER_H = HEADER_EYEBROW_PX + HEADER_EYEBROW_GAP + HEADER_TITLE_PX + HEADER_TITLE_GAP;

const STAT_ROW_GAP_BEFORE = 24;
const STAT_ROW_H = 88;
const STAT_ROW_GAP_AFTER = 24;

// Must clear TAB_VISIBLE_H so one row's tab never overlaps the row above
// it - mirrors the live grid's rowGap needing to clear the same tab.
const ROW_GAP = 40;

export type ShareImageParams = {
  games: Game[];
  picks: Record<string, TeamAbbr>;
  week: number;
  results?: Record<string, TeamAbbr>;
  avatarUrl?: string | null;
  lockedGameId?: string | null;
};

const LOCK_ICON = "/lock-of-week.png";

export async function renderShareImage(params: ShareImageParams): Promise<Blob> {
  const { games, picks, week, results, avatarUrl, lockedGameId } = params;
  const hasResults = !!results && games.some((g) => results[g.id]);
  const gradedCount = hasResults ? games.filter((g) => results![g.id]).length : 0;
  const correctCount = hasResults ? games.filter((g) => results![g.id] && picks[g.id] === results![g.id]).length : 0;
  const stats: PickStats = computePickStats(games, picks);
  const lockedTeam = lockedGameId && picks[lockedGameId] ? TEAMS[picks[lockedGameId]] : null;
  const tags = computePickTags(games, picks);
  const desktopRows: DesktopRow[] = buildDesktopRows(games);
  const rowCount = desktopRows.length;

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
  const [logoEntries, brandLogo, avatarImg, underdogIcon, boldestIcon, lockIcon] = await Promise.all([
    Promise.all(Array.from(logoUrls).map(async (url) => [url, await loadImage(url)] as const)),
    loadImage(BRAND_LOGO_SRC),
    hasResults && avatarUrl ? loadImage(avatarUrl) : Promise.resolve(null),
    loadImage(UNDERDOG_ICON),
    loadImage(BOLDEST_PICK_ICON),
    lockedGameId ? loadImage(LOCK_ICON) : Promise.resolve(null),
  ]);
  const logos = new Map(logoEntries);
  const tagIcons = new Map([[UNDERDOG_ICON, underdogIcon], [BOLDEST_PICK_ICON, boldestIcon]]);

  const bodyHeight = TAB_VISIBLE_H + rowCount * PILL_H + Math.max(0, rowCount - 1) * ROW_GAP;
  const totalHeight =
    PAD_TOP + HEADER_H + STAT_ROW_GAP_BEFORE + STAT_ROW_H + STAT_ROW_GAP_AFTER + bodyHeight + BRAND_FOOTER_H + PAD_BOTTOM;

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

  // Small eyebrow + "WEEK N" as the actual headline - mirrors the live
  // header (no more "NFL PICK'EM" line/divider; the branding is already
  // established by the eyebrow, same as the on-site header).
  ctx.font = `${HEADER_EYEBROW_PX}px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillText("SIDELINE BREW · PICK’EM", WIDTH / 2, cursorY + HEADER_EYEBROW_PX);
  cursorY += HEADER_EYEBROW_PX + HEADER_EYEBROW_GAP;

  ctx.font = `${HEADER_TITLE_PX}px ${displayFont}`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(`WEEK ${week}`, WIDTH / 2, cursorY + HEADER_TITLE_PX * 0.88);
  cursorY += HEADER_TITLE_PX + HEADER_TITLE_GAP;

  cursorY += STAT_ROW_GAP_BEFORE;

  if (hasResults) {
    const recordW = 260;
    drawResultsRecordPill(ctx, displayFont, WIDTH / 2 - recordW / 2, cursorY, recordW, STAT_ROW_H, `${correctCount}-${gradedCount - correctCount}`, avatarImg);
  } else {
    // Matches the live StatPills order: Lock of the Week took over the
    // prominent center slot (it's the more important tag), Boldest Pick
    // moved into the slot Chalk used to occupy, Chalk was removed.
    const pillDefs: Array<{
      w: number;
      borderColor: string;
      valueColor: string;
      value: string;
      label: string;
      logo?: HTMLImageElement | null;
      badgeIcon?: HTMLImageElement | null;
      logoH?: number;
      valueFontPx?: number;
      badgeSize?: number;
      fillColor?: string;
    }> = [
      { w: 172, borderColor: "#ffffff", valueColor: "#ffffff", value: String(stats.underdogCount), label: "UNDERDOGS", badgeIcon: underdogIcon },
      {
        w: 250,
        // Gold, matching the live matchup pill's own lock treatment,
        // instead of the green every other "good" stat here uses.
        borderColor: "#f59e0b",
        valueColor: "#f59e0b",
        value: lockedTeam ? "" : "-",
        label: "LOCK OF THE WEEK",
        logo: lockedTeam ? logos.get(lockedTeam.logo) : undefined,
        badgeIcon: lockIcon,
        // Bigger and left as a badge that sits astride the pill's corner
        // on purpose - a "pin," not an attempt to tuck neatly inside it
        // the way the other two badges do.
        badgeSize: 68,
        // Matches the live pill: once a team is locked, the pill's own
        // background becomes that team's color instead of the flat panel.
        fillColor: lockedTeam ? lockedTeam.color : undefined,
      },
      {
        w: 172,
        borderColor: "#ffffff",
        valueColor: "#ffffff",
        value: stats.boldestTeam ? `+${stats.boldestSpread}` : "-",
        label: "BOLDEST PICK",
        logo: stats.boldestTeam ? logos.get(stats.boldestTeam.logo) : undefined,
        badgeIcon: boldestIcon,
        // Narrower pill than this content used to have (the old 250px
        // center slot, now Lock's) - smaller logo keeps it clear of the
        // corner badge instead of crowding it.
        logoH: 48,
        // The spread number read oversized next to that smaller logo,
        // compared to how Underdogs/Lock look.
        valueFontPx: 24,
      },
    ];
    const pillGap = 24;
    const totalPillsW = pillDefs.reduce((s, p) => s + p.w, 0) + pillGap * (pillDefs.length - 1);
    let pillX = WIDTH / 2 - totalPillsW / 2;
    for (const p of pillDefs) {
      drawStatPill(ctx, displayFont, pillX, cursorY, p.w, STAT_ROW_H, p.borderColor, p.valueColor, p.value, p.label, p.logo, p.badgeIcon, p.logoH, p.valueFontPx, p.badgeSize, p.fillColor);
      pillX += p.w + pillGap;
    }
  }
  cursorY += STAT_ROW_H + STAT_ROW_GAP_AFTER;

  // Clearance for the very first row's own tab, which pokes up above it -
  // every subsequent row gets the same clearance from ROW_GAP instead.
  cursorY += TAB_VISIBLE_H;

  const col1X = PAD_X;
  const col2X = PAD_X + PILL_W + GAP_X;

  desktopRows.forEach((row, i) => {
    [
      { cell: row.left, x: col1X },
      { cell: row.right, x: col2X },
    ].forEach(({ cell, x }) => {
      if (!cell) return;
      const { game, timeLabel } = cell;
      drawGameTab(ctx, displayFont, timeLabel, x + PILL_W / 2, cursorY);

      const away = TEAMS[game.away];
      const home = TEAMS[game.home];
      const picked = picks[game.id];
      const result = results?.[game.id];
      const tag = tags[game.id];
      const halfW = PILL_W / 2;

      // Same highlight logic as the live GameCard: your pick if you made
      // one, otherwise the real winner (e.g. sharing before making a pick
      // isn't possible, but this keeps the two renderers identical in
      // spirit). Only the highlighted side ever shows an outcome letter.
      const highlighted = picked ?? (result ? result : undefined);
      function outcomeForTeam(team: TeamAbbr): "win" | "loss" | null {
        if (team !== highlighted) return null;
        // A pre-game lock owns this half's tint+stamp instead (drawn
        // separately by drawLockFill, after the borders) - returning null
        // here stops drawPillHalfFill's own win/loss treatment from also
        // firing and showing through underneath it.
        if (picked === team && game.id === lockedGameId && !result) return null;
        if (!result) return "win";
        if (!picked) return "win";
        return picked === result ? "win" : "loss";
      }
      function isFadedForTeam(team: TeamAbbr): boolean {
        return highlighted !== undefined && team !== highlighted;
      }

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
        outcome: outcomeForTeam(away.abbr),
        isFaded: isFadedForTeam(away.abbr),
        tag: picked === away.abbr ? tag : undefined,
        spreadLabel: awaySpread,
        record: game.awayRecord ?? "0-0",
        logo: logos.get(away.logo) ?? null,
        isLockPick: picked === away.abbr && game.id === lockedGameId,
      };
      const homeOpts: TeamHalfOpts = {
        x: x + halfW,
        y: cursorY,
        w: halfW,
        h: PILL_H,
        side: "right",
        team: home,
        outcome: outcomeForTeam(home.abbr),
        isFaded: isFadedForTeam(home.abbr),
        tag: picked === home.abbr ? tag : undefined,
        spreadLabel: homeSpread,
        record: game.homeRecord ?? "0-0",
        logo: logos.get(home.logo) ?? null,
        isLockPick: picked === home.abbr && game.id === lockedGameId,
      };

      // Fills first for both halves, then borders for both halves - a
      // border stroke is centered on the shared seam, so drawing a half's
      // fill after the other half's border has already run there would
      // paint over part of that stroke (see drawPillHalfFill's comment).
      drawPillHalfFill(ctx, displayFont, awayOpts, (c, midY) => drawGameFooterContent(c, displayFont, awayOpts.x, awayOpts.w, midY, awayOpts.spreadLabel, awayOpts.record));
      drawPillHalfFill(ctx, displayFont, homeOpts, (c, midY) => drawGameFooterContent(c, displayFont, homeOpts.x, homeOpts.w, midY, homeOpts.spreadLabel, homeOpts.record));
      drawPillBordersOutcomeLast(ctx, awayOpts, homeOpts);
      drawLockFill(ctx, displayFont, awayOpts);
      drawLockFill(ctx, displayFont, homeOpts);
      drawTeamHalfBadge(ctx, awayOpts, awayOpts.tag ? tagIcons.get(awayOpts.tag.icon) : undefined);
      drawTeamHalfBadge(ctx, homeOpts, homeOpts.tag ? tagIcons.get(homeOpts.tag.icon) : undefined);
      if (awayOpts.isLockPick) drawLockBadge(ctx, awayOpts, lockIcon);
      if (homeOpts.isLockPick) drawLockBadge(ctx, homeOpts, lockIcon);
    });
    if (i < desktopRows.length - 1) cursorY += PILL_H + ROW_GAP;
    else cursorY += PILL_H;
  });

  drawBrandFooter(ctx, displayFont, cursorY, brandLogo, WIDTH);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png");
  });
}
