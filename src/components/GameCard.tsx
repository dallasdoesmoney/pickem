"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

const BORDER_WIDTH = 3;

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
  const fadedFilter = isFaded ? "grayscale(0.85) brightness(0.5)" : undefined;

  return (
    <button
      onClick={onClick}
      className="relative flex-1 h-28 cursor-pointer active:scale-95 transition-transform duration-150"
      style={{ zIndex: isPicked ? 10 : 0 }}
    >
      <div
        className={`absolute inset-0 ${radius} overflow-hidden flex flex-col`}
        style={{
          borderTop: `${BORDER_WIDTH}px solid ${borderColor}`,
          borderBottom: `${BORDER_WIDTH}px solid ${borderColor}`,
          [outerBorderSide]: `${BORDER_WIDTH}px solid ${borderColor}`,
          [innerBorderSide]: isPicked ? `${BORDER_WIDTH}px solid ${borderColor}` : undefined,
          filter: fadedFilter,
        }}
      >
        <div
          className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: team.color }}
        >
          <img
            src={team.logo}
            alt={team.name}
            className="h-28 w-28 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
          />
          {isPicked && (
            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-5xl font-black"
              style={{
                color: "#4ade80",
                transform: "rotate(-12deg)",
                textShadow:
                  "-1.5px -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 1.5px 0 #000, 1.5px 1.5px 0 #000, 0 3px 5px rgba(0,0,0,0.5)",
              }}
            >
              W
            </span>
          )}
        </div>
        <div
          className="h-8 shrink-0 flex items-center justify-center gap-1.5"
          style={{
            backgroundColor: team.color,
            filter: isFaded ? undefined : "brightness(0.6)",
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
      </div>
      {isPicked && (
        <div
          className={`pointer-events-none absolute inset-0 ${radius}`}
          style={{
            boxShadow: "0 0 10px 3px rgba(74,222,128,0.75)",
          }}
        />
      )}
    </button>
  );
}

export function GameCard({
  game,
  picked,
  onPick,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
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
    <div className="relative flex items-center px-1">
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
    </div>
  );
}
