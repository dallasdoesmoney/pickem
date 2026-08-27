"use client";

import { useState } from "react";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { teamTile } from "@/lib/colorUtils";
import { playerHeadshot } from "@/lib/espnHeadshot";

// The first cell of a guess row: the player, as a card.
//
// It used to be a round photo followed by a name on the board's own navy,
// which meant a row opened with a circle and then ran seven rectangles -
// so the player never read as part of the same series. The team colour
// now runs behind the name as well, with the same 2px outline, corner
// radius and hard offset shadow a chip has, and the row becomes eight
// cards, the first of which happens to be who you guessed.
//
// THE MARK IS NOT CLIPPED TO THE PHOTO. That is the whole trick here. The
// club crest sits on the PLATE, wider than the headshot and running under
// the start of the name, so it is cut off by the card's own edge rather
// than by wherever the picture happens to stop. A crest sliced in half
// down the middle of a plate looks like a rendering bug; one that
// continues under the type looks like a jersey.
export function PlayerPlate({
  espnId,
  name,
  team,
  size = 40,
}: {
  espnId: string;
  name: string;
  team: TeamAbbr;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // bg/ink rather than the raw club colour: a white name on Vikings
  // purple and a white name on Steelers gold are not the same contrast
  // problem, and this is the same helper the reveal card already uses to
  // decide which way to go.
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
      className="puzzle-plate relative flex min-w-0 items-center gap-2 overflow-hidden rounded-[10px]"
      style={{
        background: `linear-gradient(100deg, ${bg}, ${bg}cc)`,
        border: "2px solid #0a1120",
        boxShadow: "3px 4px 0 #05090f",
        padding: 4,
        paddingRight: 10,
      }}
      title={name}
    >
      {/* Anchored to the photo's left edge and sized off the plate, so it
          reaches past the picture and under the name. Behind everything,
          and pointer-events:none so it never eats a hover. */}
      {logo && (
        <img
          src={logo}
          alt=""
          aria-hidden
          loading="lazy"
          className="pointer-events-none absolute max-w-none select-none object-contain"
          style={{
            // 1.7x the photo: big enough to run past its right edge and
            // under the start of the name - which is the point - without
            // losing so much of the crest off the top and bottom of the
            // plate that it stops being recognisable. The plate clips it,
            // the photo does not.
            height: size * 1.7,
            width: size * 1.7,
            left: size * -0.14,
            top: "50%",
            transform: "translateY(-50%)",
            opacity: 0.26,
          }}
        />
      )}

      <span
        className="relative grid shrink-0 place-items-center overflow-hidden rounded-lg"
        style={{ width: size, height: size, fontSize: Math.round(size * 0.34), fontWeight: 800, color: ink }}
      >
        {/* Only until the photo arrives. The headshots are cut out on
            transparency, so initials left underneath one show THROUGH
            him rather than behind him. */}
        {!loaded && <span>{initials}</span>}
        {!broken && (
          <img
            src={playerHeadshot(espnId)}
            alt=""
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
            className="absolute inset-0 h-full w-full select-none object-cover object-top"
          />
        )}
      </span>

      <span
        className="relative min-w-0 truncate text-sm font-semibold md:text-[13px]"
        style={{ color: ink, textShadow: ink === "#ffffff" ? "0 1px 2px rgba(0,0,0,0.45)" : "none" }}
      >
        {name}
      </span>
    </span>
  );
}
