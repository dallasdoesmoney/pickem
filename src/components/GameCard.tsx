"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

const BORDER_WIDTH = 3;

function TeamHalf({
  team,
  isPicked,
  isFaded,
  side,
  onClick,
}: {
  team: (typeof TEAMS)[TeamAbbr];
  isPicked: boolean;
  isFaded: boolean;
  side: "left" | "right";
  onClick: () => void;
}) {
  const radius = side === "left" ? "rounded-l-full" : "rounded-r-full";
  const outerBorderSide = side === "left" ? "borderLeft" : "borderRight";
  const innerBorderSide = side === "left" ? "borderRight" : "borderLeft";
  const borderColor = isPicked ? "#4ade80" : "white";

  return (
    <button
      onClick={onClick}
      className="relative flex-1 h-20 cursor-pointer active:scale-95 transition-transform duration-150"
      style={{ zIndex: isPicked ? 10 : 0 }}
    >
      <div
        className={`absolute inset-0 ${radius} overflow-hidden flex items-center justify-center`}
        style={{
          backgroundColor: team.color,
          borderTop: `${BORDER_WIDTH}px solid ${borderColor}`,
          borderBottom: `${BORDER_WIDTH}px solid ${borderColor}`,
          [outerBorderSide]: `${BORDER_WIDTH}px solid ${borderColor}`,
          [innerBorderSide]: isPicked ? `${BORDER_WIDTH}px solid ${borderColor}` : undefined,
          filter: isFaded ? "grayscale(0.85) brightness(0.5)" : undefined,
        }}
      >
        <img
          src={team.logo}
          alt={team.name}
          className="h-28 w-28 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        />
      </div>
      {isPicked && (
        <>
          <div
            className={`pointer-events-none absolute inset-0 ${radius}`}
            style={{
              boxShadow: "0 0 10px 3px rgba(74,222,128,0.75)",
            }}
          />
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-3xl font-black"
            style={{
              color: "#4ade80",
              textShadow:
                "-1.5px -1.5px 0 #052e16, 1.5px -1.5px 0 #052e16, -1.5px 1.5px 0 #052e16, 1.5px 1.5px 0 #052e16, 0 2px 6px rgba(0,0,0,0.6)",
            }}
          >
            W
          </span>
        </>
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
  const favoriteTeam = game.favorite ? TEAMS[game.favorite] : undefined;

  return (
    <div className="relative flex items-center px-1">
      <TeamHalf
        team={away}
        side="left"
        isPicked={picked === away.abbr}
        isFaded={hasPick && picked !== away.abbr}
        onClick={() => onPick(away.abbr)}
      />
      <TeamHalf
        team={home}
        side="right"
        isPicked={picked === home.abbr}
        isFaded={hasPick && picked !== home.abbr}
        onClick={() => onPick(home.abbr)}
      />
      {favoriteTeam && game.spread !== undefined && (
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: "#0e1b33",
            borderColor: "#4ade80",
            color: "#4ade80",
          }}
        >
          {favoriteTeam.abbr} -{game.spread}
        </span>
      )}
    </div>
  );
}
