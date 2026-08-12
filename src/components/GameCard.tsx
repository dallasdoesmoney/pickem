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
  return (
    <button
      onClick={onClick}
      className={[
        "relative flex-1 flex items-center justify-center rounded-full transition-all duration-150",
        "h-20 active:scale-95",
        isPicked ? "z-10 scale-105" : "z-0 scale-100",
      ].join(" ")}
      style={{
        backgroundColor: team.color,
        boxShadow: isPicked
          ? "0 0 0 3px #4ade80, 0 0 18px 2px rgba(74,222,128,0.7)"
          : undefined,
        filter: isFaded ? "grayscale(0.85) brightness(0.55)" : undefined,
        marginLeft: side === "right" ? -8 : 0,
        marginRight: side === "left" ? -8 : 0,
      }}
    >
      <img
        src={team.logo}
        alt={team.name}
        className="h-12 w-12 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]"
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
    <div className="flex items-center gap-2 px-1">
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
