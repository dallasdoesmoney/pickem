"use client";

import { TeamAbbr, TEAMS } from "@/data/teams";

// Shared pill chrome for one team's half of a matchup - used by both the
// weekly picks page (GameCard) and the season predictor (SeasonGameCard),
// so the two can't drift out of sync the way they did before this was
// extracted (different pill sizes, letter placement, and border-dimming
// behavior between the two pages).
export const PILL_WIDTH = 343; // px - fixed size, every card locks to this regardless of viewport
export const PILL_HEIGHT = 80; // px
export const FOOTER_HEIGHT = 26; // px
export const LOGO_AREA_HEIGHT = PILL_HEIGHT - FOOTER_HEIGHT; // logo centers in this region, not the full card

const BORDER_WIDTH = 4;
const OUTCOME_BORDER_WIDTH = 5;
export const WIN_COLOR = "#64e066";
const WIN_COLOR_RGB = "100,224,102";
export const LOSS_COLOR = "#ef4444";
const LOSS_COLOR_RGB = "239,68,68";
// What white looks like under the same brightness(0.55) that dims a faded
// half's fill/logo - a solid opaque gray, NOT a translucent white (a
// translucent stroke lets the fill show through the border itself, which
// reads as a rendering bug rather than a muted color).
export const FADED_BORDER_COLOR = "#8c8c8c";

export function darkenColor(hex: string, factor: number, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
}

export type PillOutcome = "win" | "loss" | null;

export function TeamHalfPill({
  team,
  side,
  outcome,
  isFaded,
  onClick,
  footer,
  badge,
  disabled,
}: {
  team: (typeof TEAMS)[TeamAbbr];
  side: "left" | "right";
  outcome: PillOutcome;
  isFaded: boolean;
  onClick: () => void;
  footer?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}) {
  const radius = side === "left" ? "rounded-l-full" : "rounded-r-full";
  const outerBorderSide = side === "left" ? "borderLeft" : "borderRight";
  const innerBorderSide = side === "left" ? "borderRight" : "borderLeft";
  const outcomeColor = outcome === "win" ? WIN_COLOR : outcome === "loss" ? LOSS_COLOR : null;
  const outcomeColorRgb = outcome === "win" ? WIN_COLOR_RGB : outcome === "loss" ? LOSS_COLOR_RGB : null;
  const borderColor = outcomeColor ?? (isFaded ? FADED_BORDER_COLOR : "white");
  const borderWidth = outcomeColor ? OUTCOME_BORDER_WIDTH : BORDER_WIDTH;
  const fadedFilter = isFaded ? "grayscale(0.5) brightness(0.55)" : undefined;

  return (
    // Content (fill/logo/footer/letter) always stays at the base stacking
    // level so a page can layer its own overlay (e.g. the predictor's
    // shared week label) above it. The border ring is its own layer on top
    // of everything - always fully opaque so a picked half's colored
    // border stays a continuous unbroken ring; a faded half's border dims
    // to a solid gray in step with its fill/logo.
    <div className="relative flex-1" style={{ height: PILL_HEIGHT }}>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`absolute inset-0 h-full w-full transition-transform duration-150 ${disabled ? "cursor-default" : "cursor-pointer active:scale-95"}`}
      >
        <div className={`absolute inset-0 ${radius} overflow-hidden`} style={{ backgroundColor: team.color, filter: fadedFilter }}>
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
            className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5"
            style={{ height: FOOTER_HEIGHT, backgroundColor: isFaded ? team.color : darkenColor(team.color, 0.6, 0.93) }}
          >
            {footer}
          </div>
          {outcomeColor && (
            <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(${outcomeColorRgb},0.34)` }} />
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
      </button>
      <div
        className={`pointer-events-none absolute inset-0 ${radius} z-30`}
        style={{
          borderTop: `${borderWidth}px solid ${borderColor}`,
          borderBottom: `${borderWidth}px solid ${borderColor}`,
          [outerBorderSide]: `${borderWidth}px solid ${borderColor}`,
          [innerBorderSide]: outcomeColor ? `${borderWidth}px solid ${borderColor}` : undefined,
          boxShadow: outcomeColor ? `0 0 6px 1px rgba(${outcomeColorRgb},0.6)` : undefined,
        }}
      />
      {badge}
    </div>
  );
}
