"use client";

import { useRef } from "react";
import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

const BORDER_WIDTH = 4;
const PICKED_BORDER_WIDTH = 5;
const LOCK_BORDER_WIDTH = 5;
const LONG_PRESS_MS = 450;
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

function LockBadge({ side }: { side: "left" | "right" }) {
  return (
    <div
      className="pointer-events-none absolute -top-2.5 z-20 text-[42px] leading-none"
      style={{
        [side === "left" ? "left" : "right"]: "-10px",
        transform: `rotate(${side === "left" ? "-22deg" : "22deg"})`,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
      }}
    >
      &#128274;
    </div>
  );
}

function TeamHalf({
  team,
  isPicked,
  isFaded,
  isLocked,
  side,
  spreadLabel,
  record,
  onClick,
  onLongPress,
}: {
  team: (typeof TEAMS)[TeamAbbr];
  isPicked: boolean;
  isFaded: boolean;
  isLocked: boolean;
  side: "left" | "right";
  spreadLabel?: string;
  record: string;
  onClick: () => void;
  onLongPress?: () => void;
}) {
  const radius = side === "left" ? "rounded-l-full" : "rounded-r-full";
  const outerBorderSide = side === "left" ? "borderLeft" : "borderRight";
  const innerBorderSide = side === "left" ? "borderRight" : "borderLeft";
  const borderColor = isLocked ? "#fbbf24" : isPicked ? "#4ade80" : "white";
  const borderWidth = isLocked ? LOCK_BORDER_WIDTH : isPicked ? PICKED_BORDER_WIDTH : BORDER_WIDTH;
  const fadedFilter = isFaded ? "grayscale(0.5) brightness(0.55)" : undefined;

  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  function startPressTimer() {
    if (!isPicked || !onLongPress) return;
    longPressFired.current = false;
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      onLongPress();
    }, LONG_PRESS_MS);
  }
  function clearPressTimer() {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }
  function handleClick() {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    onClick();
  }

  return (
    <button
      onClick={handleClick}
      onPointerDown={startPressTimer}
      onPointerUp={clearPressTimer}
      onPointerLeave={clearPressTimer}
      onPointerCancel={clearPressTimer}
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
            boxShadow: isLocked
              ? "0 0 8px 2px rgba(251,191,36,0.7)"
              : "0 0 6px 1px rgba(74,222,128,0.6)",
          }}
        />
      )}
      {isPicked && isLocked && <LockBadge side={side} />}
    </button>
  );
}

export function GameCard({
  game,
  picked,
  onPick,
  isLocked = false,
  onToggleLock,
  locksAvailable = true,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  isLocked?: boolean;
  onToggleLock?: () => void;
  locksAvailable?: boolean;
}) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];
  const hasPick = !!picked;
  const canLongPress = onToggleLock && (isLocked || locksAvailable);

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
        isLocked={isLocked && picked === away.abbr}
        spreadLabel={awaySpread}
        record={game.awayRecord ?? "0-0"}
        onClick={() => onPick(away.abbr)}
        onLongPress={canLongPress ? onToggleLock : undefined}
      />
      <TeamHalf
        team={home}
        side="right"
        isPicked={picked === home.abbr}
        isFaded={hasPick && picked !== home.abbr}
        isLocked={isLocked && picked === home.abbr}
        spreadLabel={homeSpread}
        record={game.homeRecord ?? "0-0"}
        onClick={() => onPick(home.abbr)}
        onLongPress={canLongPress ? onToggleLock : undefined}
      />
    </div>
  );
}
