"use client";

import { TeamAbbr, TEAMS } from "@/data/teams";

// Pre-season prediction mode: same visual language as the weekly GameCard
// (pill halves, green picked border/glow, "W" overlay), but there's no
// spread or record to show yet, so the footer bar is dropped entirely and
// the logo simply fills the whole pill height instead.
export const SEASON_PILL_WIDTH = 343;
export const SEASON_PILL_HEIGHT = 64;

const BORDER_WIDTH = 4;
const OUTCOME_BORDER_WIDTH = 5;
const WIN_COLOR = "#64e066";
const WIN_COLOR_RGB = "100,224,102";
const LOSS_COLOR = "#ef4444";
const LOSS_COLOR_RGB = "239,68,68";

// Result of a prediction, from the tracked team's own perspective - shown
// only on the tracked team's half regardless of which side was tapped.
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
          className={`absolute inset-0 ${radius} overflow-hidden flex items-center justify-center`}
          style={{
            backgroundColor: team.color,
            borderTop: `${borderWidth}px solid ${borderColor}`,
            borderBottom: `${borderWidth}px solid ${borderColor}`,
            [outerBorderSide]: `${borderWidth}px solid ${borderColor}`,
            [innerBorderSide]: outcomeColor ? `${borderWidth}px solid ${borderColor}` : undefined,
            filter: fadedFilter,
          }}
        >
          <img
            src={team.logo}
            alt={team.name}
            draggable={false}
            crossOrigin="anonymous"
            className="h-[92px] w-auto max-w-none select-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
            style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
          />
          {outcomeColor && (
            <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(${outcomeColorRgb},0.16)` }} />
          )}
          {outcomeColor && (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl"
              style={{
                fontFamily: "var(--font-display)",
                color: outcomeColor,
                transform: "rotate(-12deg)",
                textShadow: "-1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff, 0 3px 5px rgba(0,0,0,0.4)",
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
  picked,
  onPick,
}: {
  away: TeamAbbr;
  home: TeamAbbr;
  trackedTeam: TeamAbbr;
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

  return (
    <div className="relative flex items-center mx-auto flex-1 min-w-0 max-w-[343px]">
      <SeasonTeamHalf
        team={awayTeam}
        side="left"
        outcome={outcomeFor(away)}
        isFaded={hasPick && picked !== away}
        onClick={() => onPick(away)}
      />
      <SeasonTeamHalf
        team={homeTeam}
        side="right"
        outcome={outcomeFor(home)}
        isFaded={hasPick && picked !== home}
        onClick={() => onPick(home)}
      />
    </div>
  );
}

// Matches SeasonGameCard's footprint exactly so a bye week doesn't disrupt
// the rhythm of the list - same width/height, just a single muted pill
// instead of a pickable pair.
export function SeasonByeCard({ team }: { team: TeamAbbr }) {
  const t = TEAMS[team];
  return (
    <div
      className="relative flex items-center justify-center mx-auto flex-1 min-w-0 max-w-[343px] rounded-full border-2 border-white/15 bg-white/[0.03]"
      style={{ height: SEASON_PILL_HEIGHT }}
    >
      <img src={t.logo} alt="" className="h-10 w-auto opacity-25 mr-3" crossOrigin="anonymous" />
      <span className="text-white/35 text-lg tracking-[0.2em]" style={{ fontFamily: "var(--font-display)" }}>
        BYE WEEK
      </span>
    </div>
  );
}
