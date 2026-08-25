"use client";

import { useState } from "react";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { teamTile } from "@/lib/colorUtils";
import { playerHeadshot } from "@/lib/espnHeadshot";
import { BACKDROP_OPACITY, BACKDROP_SCALE } from "@/lib/teamBackdrop";

// A player's face, with the fallback built in rather than bolted on.
//
// Three layers, and each one is doing a job:
//
//   1. the team's colour, always
//   2. the team's mark, ghosted - the same backdrop the tier list puts
//      behind its players, because ESPN's headshots are cut out on
//      transparency and whatever sits behind them IS the picture. Without
//      it a board of faces is a board of coloured discs; with it you can
//      tell a Raven from a Viking before you have read the name.
//   3. the headshot
//
// A player ESPN has no picture for therefore shows their initials on
// their own colour over their own mark, instead of a hole.
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
  const logo = TEAMS[team]?.logo;

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
      {/* Centred by translate rather than by insets: the mark is wider
          than the disc on purpose, and insets would squash it back to fit
          instead of letting it bleed. */}
      {logo && (
        <img
          src={logo}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute max-w-none object-contain"
          style={{
            width: `${BACKDROP_SCALE * 100}%`,
            height: `${BACKDROP_SCALE * 100}%`,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            opacity: BACKDROP_OPACITY,
          }}
        />
      )}
      <span className="relative">{initials}</span>
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
