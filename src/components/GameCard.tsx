"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";
import { PickTag } from "@/lib/pickLayout";

const BORDER_WIDTH = 4;
const PICKED_BORDER_WIDTH = 5;
export const PILL_WIDTH = 343; // px - fixed size, every card locks to this regardless of viewport
export const PILL_HEIGHT = 80; // px
const FOOTER_HEIGHT = 26; // px
const LOGO_AREA_HEIGHT = PILL_HEIGHT - FOOTER_HEIGHT; // logo centers in this region, not the full card
const PICKED_COLOR = "#64e066"; // border + "W" color for a picked team
const PICKED_COLOR_RGB = "100,224,102"; // same color, for rgba() glow/tint

function darkenColor(hex: string, factor: number, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
}

// Auto-computed tags (underdog/boldest pick) - purely informational, no
// interaction, so this is just a badge rather than a button.
function TagBadge({ side, tag }: { side: "left" | "right"; tag: PickTag }) {
  const positionStyle = { [side === "left" ? "left" : "right"]: "-10px" } as const;
  return (
    <span
      role="img"
      aria-label={tag.label}
      className="absolute -top-2.5 z-20 text-[42px] leading-none pointer-events-none"
      style={{
        ...positionStyle,
        transform: `rotate(${side === "left" ? "-22deg" : "22deg"})`,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
      }}
    >
      {tag.emoji}
    </span>
  );
}

function TeamHalf({
  team,
  isPicked,
  isFaded,
  tag,
  side,
  spreadLabel,
  record,
  onClick,
}: {
  team: (typeof TEAMS)[TeamAbbr];
  isPicked: boolean;
  isFaded: boolean;
  tag?: PickTag;
  side: "left" | "right";
  spreadLabel?: string;
  record: string;
  onClick: () => void;
}) {
  const radius = side === "left" ? "rounded-l-full" : "rounded-r-full";
  const outerBorderSide = side === "left" ? "borderLeft" : "borderRight";
  const innerBorderSide = side === "left" ? "borderRight" : "borderLeft";
  const borderColor = isPicked ? PICKED_COLOR : "white";
  const borderWidth = isPicked ? PICKED_BORDER_WIDTH : BORDER_WIDTH;
  const fadedFilter = isFaded ? "grayscale(0.5) brightness(0.55)" : undefined;

  return (
    <div
      className="relative flex-1"
      style={{ height: PILL_HEIGHT, zIndex: isPicked ? 10 : 0 }}
    >
      <button
        onClick={onClick}
        className="absolute inset-0 h-full w-full cursor-pointer active:scale-95 transition-transform duration-150"
      >
      <div
        className={`absolute inset-0 ${radius} overflow-hidden`}
        style={{
          backgroundColor: team.color,
          borderTop: `${borderWidth}px solid ${borderColor}`,
          borderBottom: `${borderWidth}px solid ${borderColor}`,
          [outerBorderSide]: `${borderWidth}px solid ${borderColor}`,
          [innerBorderSide]: isPicked ? `${borderWidth}px solid ${borderColor}` : undefined,
          filter: fadedFilter,
        }}
      >
        <div
          className="absolute inset-x-0 top-0 flex items-center justify-center"
          style={{ height: LOGO_AREA_HEIGHT }}
        >
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
          style={{
            height: FOOTER_HEIGHT,
            backgroundColor: isFaded ? team.color : darkenColor(team.color, 0.6, 0.93),
          }}
        >
          {spreadLabel && (
            <span
              className="text-sm text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {spreadLabel}
            </span>
          )}
          <span className="text-[10px] text-white/70">{record}</span>
        </div>
        {isPicked && (
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: `rgba(${PICKED_COLOR_RGB},0.16)` }}
          />
        )}
        {isPicked && (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl"
            style={{
              fontFamily: "var(--font-display)",
              color: PICKED_COLOR,
              transform: "rotate(-12deg)",
              textShadow:
                "-1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff, 0 3px 5px rgba(0,0,0,0.4)",
            }}
          >
            W
          </span>
        )}
      </div>
      {isPicked && (
        <div
          className={`pointer-events-none absolute inset-0 ${radius}`}
          style={{ boxShadow: `0 0 6px 1px rgba(${PICKED_COLOR_RGB},0.6)` }}
        />
      )}
      </button>
      {isPicked && tag && <TagBadge side={side} tag={tag} />}
    </div>
  );
}

export function GameCard({
  game,
  picked,
  onPick,
  tag,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  tag?: PickTag;
}) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];
  const hasPick = !!picked;

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

  return (
    <div
      className="relative flex items-center mx-auto shrink-0"
      style={{ width: PILL_WIDTH }}
    >
      <TeamHalf
        team={away}
        side="left"
        isPicked={picked === away.abbr}
        isFaded={hasPick && picked !== away.abbr}
        tag={picked === away.abbr ? tag : undefined}
        spreadLabel={awaySpread}
        record={game.awayRecord ?? "0-0"}
        onClick={() => onPick(away.abbr)}
      />
      <TeamHalf
        team={home}
        side="right"
        isPicked={picked === home.abbr}
        isFaded={hasPick && picked !== home.abbr}
        tag={picked === home.abbr ? tag : undefined}
        spreadLabel={homeSpread}
        record={game.homeRecord ?? "0-0"}
        onClick={() => onPick(home.abbr)}
      />
    </div>
  );
}
