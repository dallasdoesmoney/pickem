"use client";

import { TeamAbbr, TEAMS } from "@/data/teams";
import { FOOTER_HEIGHT, LOGO_AREA_HEIGHT, PILL_HEIGHT, PILL_WIDTH, TeamHalfPill } from "@/components/TeamHalfPill";
import { isSuspiciousPick } from "@/data/powerRankings";

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
function SuspiciousBadge({ side }: { side: "left" | "right" }) {
  const positionStyle = { [side === "left" ? "left" : "right"]: "-10px" } as const;
  return (
    <img
      src="/suspicious-dog.png"
      alt="Suspicious pick"
      className="absolute -top-2.5 z-40 h-11 w-auto pointer-events-none select-none"
      style={{
        ...positionStyle,
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
}: {
  away: TeamAbbr;
  home: TeamAbbr;
  trackedTeam: TeamAbbr;
  week: number;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
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
    // isolate scopes the halves' z-30 border layers and this card's z-20
    // week label to a fresh local stacking context, so those values only
    // ever compete with each other - without it they compare against the
    // page's global stacking order and can render above a sticky header
    // while scrolling.
    <div className="relative isolate flex items-center mx-auto shrink-0" style={{ width: SEASON_PILL_WIDTH }}>
      <TeamHalfPill
        team={awayTeam}
        side="left"
        outcome={outcomeFor(away)}
        isFaded={isFadedFor(away)}
        onClick={() => onPick(away)}
        badge={suspicious && picked === away ? <SuspiciousBadge side="left" /> : undefined}
      />
      <TeamHalfPill
        team={homeTeam}
        side="right"
        outcome={outcomeFor(home)}
        isFaded={isFadedFor(home)}
        onClick={() => onPick(home)}
        badge={suspicious && picked === home ? <SuspiciousBadge side="right" /> : undefined}
      />
      <span
        className={`pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center text-xs tracking-wide z-20 ${hasPick ? "text-white/50" : "text-white"}`}
        style={{ height: FOOTER_HEIGHT, fontFamily: "var(--font-display)" }}
      >
        WEEK {week}
      </span>
    </div>
  );
}

// Matches SeasonGameCard's footprint exactly so a bye week doesn't disrupt
// the rhythm of the list - same width/height, just a single muted pill
// instead of a pickable pair.
export function SeasonByeCard({ team, week }: { team: TeamAbbr; week: number }) {
  const t = TEAMS[team];
  return (
    <div
      className="relative mx-auto shrink-0 rounded-full border-2 border-white/15 bg-white/[0.03] overflow-hidden"
      style={{ width: SEASON_PILL_WIDTH, height: SEASON_PILL_HEIGHT }}
    >
      <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: LOGO_AREA_HEIGHT }}>
        <img src={t.logo} alt="" className="h-10 w-auto mr-3" crossOrigin="anonymous" />
        <span className="text-white text-lg tracking-[0.2em]" style={{ fontFamily: "var(--font-display)" }}>
          BYE WEEK
        </span>
      </div>
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center text-white/50 text-xs tracking-wide"
        style={{ height: FOOTER_HEIGHT, fontFamily: "var(--font-display)" }}
      >
        WEEK {week}
      </div>
    </div>
  );
}
