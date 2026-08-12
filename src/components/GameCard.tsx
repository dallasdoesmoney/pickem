"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

const BORDER_WIDTH = 4;
const GLOW_WIDTH = 5;

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

  return (
    <button
      onClick={onClick}
      className="relative flex-1 h-28 active:scale-95 transition-transform duration-150"
      style={{ zIndex: isPicked ? 10 : 0 }}
    >
      <div
        className={`absolute inset-0 ${radius} overflow-hidden flex items-center justify-center`}
        style={{
          backgroundColor: team.color,
          borderTop: `${BORDER_WIDTH}px solid white`,
          borderBottom: `${BORDER_WIDTH}px solid white`,
          [outerBorderSide]: `${BORDER_WIDTH}px solid white`,
          filter: isFaded ? "grayscale(0.85) brightness(0.5)" : undefined,
        }}
      >
        <img
          src={team.logo}
          alt={team.name}
          className="h-40 w-40 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
        />
      </div>
      {isPicked && (
        <div
          className={`pointer-events-none absolute inset-0 ${radius}`}
          style={{
            boxShadow: `0 0 0 ${GLOW_WIDTH}px #4ade80, 0 0 26px 6px rgba(74,222,128,0.85)`,
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

  return (
    <div className="flex items-center px-1">
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
    </div>
  );
}
