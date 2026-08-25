"use client";

import { useState } from "react";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { teamTile } from "@/lib/colorUtils";
import { playerHeadshot } from "@/lib/espnHeadshot";

// A player's face, with the fallback built in rather than bolted on.
//
// The disc is ALWAYS the team's colour and the photo sits on top of it, so
// a player ESPN has no picture for shows their initials on their own
// colour instead of a hole. That matters more than it used to: ESPN has a
// headshot for most starters and for far fewer of the three thousand
// players the guess list now opens up to, so "no photo" is the common case
// down the roster rather than the rare one.
//
// onError rather than a pre-flight check: there is no way to know whether
// a CDN URL resolves without asking for it, and asking twice to find out
// would double the requests on a board with eight rows.
export function PlayerFace({
  espnId,
  name,
  team,
  size = 30,
  ring = 3,
}: {
  espnId: string;
  name: string;
  team: TeamAbbr;
  size?: number;
  ring?: number;
}) {
  const [broken, setBroken] = useState(false);
  const { bg, ink } = teamTile(TEAMS[team]?.color ?? "#334155");

  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();

  return (
    <span
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: bg,
        color: ink,
        border: `${ring}px solid #16181c`,
        fontSize: Math.round(size * 0.34),
        fontWeight: 800,
      }}
    >
      {initials}
      {!broken && (
        <img
          src={playerHeadshot(espnId)}
          alt=""
          onError={() => setBroken(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
}
