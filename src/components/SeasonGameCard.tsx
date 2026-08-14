"use client";

import { TeamAbbr, TEAMS } from "@/data/teams";

// Pre-season prediction mode: sized and styled identically to the weekly
// GameCard pill (same width/height/footer band) so the two pages feel like
// one product. The only real difference is the footer - there's no spread
// or record yet, so instead of each half showing its own stat line, one
// shared "WEEK N" label sits centered across the whole pill, straddling
// the seam between the two halves.
export const SEASON_PILL_WIDTH = 343;
export const SEASON_PILL_HEIGHT = 80;
const FOOTER_HEIGHT = 26;
const LOGO_AREA_HEIGHT = SEASON_PILL_HEIGHT - FOOTER_HEIGHT;

const BORDER_WIDTH = 4;
const OUTCOME_BORDER_WIDTH = 5;
const WIN_COLOR = "#64e066";
const WIN_COLOR_RGB = "100,224,102";
const LOSS_COLOR = "#ef4444";
const LOSS_COLOR_RGB = "239,68,68";

function darkenColor(hex: string, factor: number, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
}

type Outcome = "win" | "loss" | null;

function SeasonTeamHalf({
  team,
  side,
  outcome,
  isFaded,
  onClick,
}: {
  team: (typeof TEAMS)[TeamAbbr];
  side: "left" | "right";
  outcome: Outcome;
  isFaded: boolean;
  onClick: () => void;
}) {
  const radius = side === "left" ? "rounded-l-full" : "rounded-r-full";
  const outerBorderSide = side === "left" ? "borderLeft" : "borderRight";
  const innerBorderSide = side === "left" ? "borderRight" : "borderLeft";
  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;
  const outcomeColorRgb = outcome === "win" ? WIN_COLOR_RGB : outcome === "loss" ? LOSS_COLOR_RGB : null;
  const borderColor = outcomeColor ?? "white";
  const borderWidth = outcomeColor ? OUTCOME_BORDER_WIDTH : BORDER_WIDTH;
  const fadedFilter = isFaded ? "grayscale(0.5) brightness(0.55)" : undefined;

  return (
    <div className="relative flex-1" style={{ height: SEASON_PILL_HEIGHT, zIndex: outcomeColor ? 10 : 0 }}>
      <button onClick={onClick} className="absolute inset-0 h-full w-full cursor-pointer active:scale-95 transition-transform duration-150">
        <div
          className={`absolute inset-0 ${radius} overflow-hidden`}
          style={{
            backgroundColor: team.color,
            borderTop: `${borderWidth}px solid ${borderColor}`,
            borderBottom: `${borderWidth}px solid ${borderColor}`,
            [outerBorderSide]: `${borderWidth}px solid ${borderColor}`,
            [innerBorderSide]: outcomeColor ? `${borderWidth}px solid ${borderColor}` : undefined,
            filter: fadedFilter,
          }}
        >
          <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: LOGO_AREA_HEIGHT }}>
            <img
              src={team.logo}
              alt={team.name}
              draggable={false}
              crossOrigin="anonymous"
              className="h-[117px] w-auto max-w-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
              style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
            />
          </div>
          <div
            className="absolute inset-x-0 bottom-0"
            style={{ height: FOOTER_HEIGHT, backgroundColor: darkenColor(team.color, 0.6, 0.93) }}
          />
          {outcomeColor && (
            <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(${outcomeColorRgb},0.16)` }} />
          )}
          {outcomeColor && (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl"
              style={{
                fontFamily: "var(--font-display)",
                color: outcomeColor,
                transform: "rotate(-12deg)",
                textShadow:
                  "-1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff, 0 3px 5px rgba(0,0,0,0.4)",
              }}
            >
              {outcome === "win" ? "W" : "L"}
            </span>
          )}
        </div>
        {outcomeColor && (
          <div className={`pointer-events-none absolute inset-0 ${radius}`} style={{ boxShadow: `0 0 6px 1px rgba(${outcomeColorRgb},0.6)` }} />
        )}
      </button>
    </div>
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

  function outcomeFor(team: TeamAbbr): Outcome {
    if (!hasPick || team !== trackedTeam) return null;
    return picked === trackedTeam ? "win" : "loss";
  }

  // Inverted from the weekly picks: the tracked team is the whole point of
  // this page, so it never dims - only the opponent does, regardless of
  // which of the two is predicted to win.
  function isFadedFor(team: TeamAbbr): boolean {
    return hasPick && team !== trackedTeam;
  }

  return (
    <div className="relative flex items-center mx-auto shrink-0" style={{ width: SEASON_PILL_WIDTH }}>
      <SeasonTeamHalf team={awayTeam} side="left" outcome={outcomeFor(away)} isFaded={isFadedFor(away)} onClick={() => onPick(away)} />
      <SeasonTeamHalf team={homeTeam} side="right" outcome={outcomeFor(home)} isFaded={isFadedFor(home)} onClick={() => onPick(home)} />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center text-white text-xs tracking-wide z-20"
        style={{ height: FOOTER_HEIGHT, fontFamily: "var(--font-display)", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}
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
