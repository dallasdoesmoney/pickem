"use client";

import { TeamAbbr, TEAMS } from "@/data/teams";
import { FOOTER_HEIGHT, LOGO_AREA_HEIGHT, PILL_HEIGHT, PILL_WIDTH, TeamHalfPill } from "@/components/TeamHalfPill";
import { isSuspiciousPick } from "@/data/powerRankings";

export { COMPACT_SCALE } from "@/components/GameCard";

// Pre-season prediction mode: sized and styled identically to the weekly
// GameCard pill (shares TeamHalfPill, so they can't drift apart). The only
// real difference is the footer - there's no spread or record yet, so
// instead of each half showing its own stat line, one shared "WEEK N"
// label sits centered across the whole pill, straddling the seam between
// the two halves.
export const SEASON_PILL_WIDTH = PILL_WIDTH;
export const SEASON_PILL_HEIGHT = PILL_HEIGHT;

// Side-eye dog meme on the corner of the predicted winner's half when the
// pick defies the power rankings - same placement pattern as the weekly
// page's underdog/boldest emoji badges. Jumbo-zoom entrance on mount (see
// suspicious-jumbo in globals.css); the resting rotation and the start
// offset live in custom properties because the keyframes own `transform`,
// so a static inline rotate would be overwritten while the animation runs.
function SuspiciousBadge({ side, scale = 1 }: { side: "left" | "right"; scale?: number }) {
  const offset = 10 * scale;
  const positionStyle = { [side === "left" ? "left" : "right"]: `-${offset}px` } as const;
  return (
    <img
      src="/suspicious-dog.png"
      alt="Suspicious pick"
      className="absolute z-40 w-auto pointer-events-none select-none"
      style={{
        ...positionStyle,
        top: `-${offset}px`,
        height: 44 * scale,
        "--peek-rot": side === "left" ? "-22deg" : "22deg",
        "--jumbo-x": side === "left" ? "120px" : "-120px",
        transform: `rotate(${side === "left" ? "-22deg" : "22deg"})`,
        transformOrigin: side === "left" ? "40% 60%" : "60% 60%",
        animation: "suspicious-jumbo 1.5s cubic-bezier(0.35, 0, 0.15, 1) both",
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
      } as React.CSSProperties}
    />
  );
}

export function SeasonGameCard({
  away,
  home,
  trackedTeam,
  week,
  picked,
  onPick,
  scale = 1,
}: {
  away: TeamAbbr;
  home: TeamAbbr;
  trackedTeam: TeamAbbr;
  week: number;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  // Arbitrary scale factor rather than a boolean compact mode - the
  // predictor's grid now solves for whatever scale fits the real viewport
  // (same as the weekly page), so a single fixed 0.85 isn't enough.
  scale?: number;
}) {
  const awayTeam = TEAMS[away];
  const homeTeam = TEAMS[home];
  const hasPick = !!picked;

  function outcomeFor(team: TeamAbbr): "win" | "loss" | null {
    if (!hasPick || team !== trackedTeam) return null;
    return picked === trackedTeam ? "win" : "loss";
  }

  // Inverted from the weekly picks: the tracked team is the whole point of
  // this page, so it never dims - only the opponent does, regardless of
  // which of the two is predicted to win.
  function isFadedFor(team: TeamAbbr): boolean {
    return hasPick && team !== trackedTeam;
  }

  const suspicious = hasPick && isSuspiciousPick(picked, picked === away ? home : away, picked === home);

  return (
    // No isolate here - the suspicious-pick badge scales up huge and needs
    // to escape this card's own box to render above EVERY other card on
    // the page, not just within a locally-scoped stacking context. That's
    // safe now that the sticky header (NavShell) sits at z-50, above
    // every in-card z-index (badge z-40, border z-30, label z-20) - see
    // NavShell.tsx for the other half of this.
    <div className="relative flex items-center mx-auto shrink-0" style={{ width: SEASON_PILL_WIDTH * scale }}>
      <TeamHalfPill
        team={awayTeam}
        side="left"
        outcome={outcomeFor(away)}
        isFaded={isFadedFor(away)}
        onClick={() => onPick(away)}
        badge={suspicious && picked === away ? <SuspiciousBadge side="left" scale={scale} /> : undefined}
        scale={scale}
      />
      <TeamHalfPill
        team={homeTeam}
        side="right"
        outcome={outcomeFor(home)}
        isFaded={isFadedFor(home)}
        onClick={() => onPick(home)}
        badge={suspicious && picked === home ? <SuspiciousBadge side="right" scale={scale} /> : undefined}
        scale={scale}
      />
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center tracking-wide z-20 ${hasPick ? "text-white/50" : "text-white"}`}
        style={{ height: FOOTER_HEIGHT * scale, fontSize: 12 * scale, fontFamily: "var(--font-display)" }}
      >
        WEEK {week}
      </span>
    </div>
  );
}

// Matches SeasonGameCard's footprint exactly so a bye week doesn't disrupt
// the rhythm of the list - same width/height, just a single muted pill
// instead of a pickable pair.
export function SeasonByeCard({ team, week, scale = 1 }: { team: TeamAbbr; week: number; scale?: number }) {
  const t = TEAMS[team];
  return (
    <div
      className="relative mx-auto shrink-0 rounded-full border-2 border-white/15 bg-white/[0.03] overflow-hidden"
      style={{ width: SEASON_PILL_WIDTH * scale, height: SEASON_PILL_HEIGHT * scale }}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: LOGO_AREA_HEIGHT * scale }}>
        <img src={t.logo} alt="" className="w-auto" style={{ height: 56 * scale, marginRight: 16 * scale }} crossOrigin="anonymous" />
        <span className="text-white tracking-[0.2em]" style={{ fontSize: 24 * scale, fontFamily: "var(--font-display)" }}>
          BYE WEEK
        </span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center text-white/50 tracking-wide"
        style={{ height: FOOTER_HEIGHT * scale, fontSize: 12 * scale, fontFamily: "var(--font-display)" }}
      >
        WEEK {week}
      </div>
    </div>
  );
}
