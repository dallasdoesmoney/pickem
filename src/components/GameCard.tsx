"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

const BORDER_WIDTH = 4;
const PICKED_BORDER_WIDTH = 5;
export const PILL_WIDTH = 343; // px - fixed size, every card locks to this regardless of viewport
export const PILL_HEIGHT = 80; // px
const FOOTER_HEIGHT = 26; // px
const LOGO_AREA_HEIGHT = PILL_HEIGHT - FOOTER_HEIGHT; // logo centers in this region, not the full card

function darkenColor(hex: string, factor: number, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)},${alpha})`;
}

function TeamHalf({
  team,
  isPicked,
  isFaded,
  side,
  spreadLabel,
  record,
  onClick,
}: {
  team: (typeof TEAMS)[TeamAbbr];
  isPicked: boolean;
  isFaded: boolean;
  side: "left" | "right";
  spreadLabel?: string;
  record: string;
  onClick: () => void;
}) {
  const radius = side === "left" ? "rounded-l-full" : "rounded-r-full";
  const outerBorderSide = side === "left" ? "borderLeft" : "borderRight";
  const innerBorderSide = side === "left" ? "borderRight" : "borderLeft";
  const borderColor = isPicked ? "#4ade80" : "white";
  const borderWidth = isPicked ? PICKED_BORDER_WIDTH : BORDER_WIDTH;
  const fadedFilter = isFaded ? "grayscale(0.5) brightness(0.55)" : undefined;

  return (
    <button
      onClick={onClick}
      className="relative flex-1 cursor-pointer active:scale-95 transition-transform duration-150"
      style={{ height: PILL_HEIGHT, zIndex: isPicked ? 10 : 0 }}
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
            className="h-[117px] w-auto max-w-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
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
            style={{ backgroundColor: "rgba(74,222,128,0.16)" }}
          />
        )}
        {isPicked && (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl"
            style={{
              fontFamily: "var(--font-display)",
              color: "#4ade80",
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
          style={{
            boxShadow: "0 0 6px 1px rgba(74,222,128,0.6)",
          }}
        />
      )}
    </button>
  );
}

function LockToggle({
  isLocked,
  disabled,
  onClick,
}: {
  isLocked: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const color = disabled ? "#5b6472" : isLocked ? "#fbbf24" : "#e5e7eb";
  return (
    <button
      aria-label={isLocked ? "Unlock this pick" : "Lock this pick for double points"}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="absolute left-1/2 -top-[13px] z-20 flex h-[26px] w-[26px] -translate-x-1/2 items-center justify-center rounded-full"
      style={{
        backgroundColor: "#0e1b33",
        border: `2px solid ${color}`,
        cursor: disabled ? "default" : "pointer",
        boxShadow: isLocked ? "0 0 6px 1px rgba(251,191,36,0.7)" : undefined,
      }}
    >
      <svg width="12" height="13" viewBox="0 0 12 13" fill="none">
        <rect x="1.5" y="5.5" width="9" height="6.5" rx="1.5" fill={color} />
        <path
          d="M3.5 5.5V3.75a2.5 2.5 0 0 1 5 0V5.5"
          stroke={color}
          strokeWidth="1.4"
          fill="none"
        />
      </svg>
    </button>
  );
}

export function GameCard({
  game,
  picked,
  onPick,
  isLocked = false,
  onToggleLock,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
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
        spreadLabel={awaySpread}
        record={game.awayRecord ?? "0-0"}
        onClick={() => onPick(away.abbr)}
      />
      <TeamHalf
        team={home}
        side="right"
        isPicked={picked === home.abbr}
        isFaded={hasPick && picked !== home.abbr}
        spreadLabel={homeSpread}
        record={game.homeRecord ?? "0-0"}
        onClick={() => onPick(home.abbr)}
      />
      {onToggleLock && (
        <LockToggle isLocked={isLocked} disabled={!hasPick} onClick={onToggleLock} />
      )}
    </div>
  );
}
