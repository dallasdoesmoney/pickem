"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";

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
  const shapeClasses =
    side === "left"
      ? "rounded-l-full border-l-[3px] border-t-[3px] border-b-[3px]"
      : "rounded-r-full border-r-[3px] border-t-[3px] border-b-[3px]";

  return (
    <button
      onClick={onClick}
      className={[
        "relative flex-1 flex items-center justify-center transition-all duration-150 border-white",
        shapeClasses,
        "h-28 active:scale-95",
      ].join(" ")}
      style={{
        backgroundColor: team.color,
        boxShadow: isPicked
          ? "0 0 0 3px #4ade80, 0 0 22px 4px rgba(74,222,128,0.8)"
          : undefined,
        filter: isFaded ? "grayscale(0.85) brightness(0.5)" : undefined,
      }}
    >
      <img
        src={team.logo}
        alt={team.name}
        className="h-24 w-24 object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]"
      />
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
