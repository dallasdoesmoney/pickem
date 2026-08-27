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
}: {
  espnId: string;
  name: string;
  team: TeamAbbr;
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
      // h-full from md up, so the plate is exactly as tall as the chips
      // beside it rather than a fixed 52 sitting inside a 62px row with
      // five pixels of dead space above and below. The row's own height
      // comes from the chips; this just fills it - and the photo, being
      // a square of that height, gets bigger for free.
      //
      // No padding on the photo's side. The picture is flush with the
      // left, the top AND the bottom, so a player stands on the edge of
      // his own card rather than floating in a moat.
      className="puzzle-plate relative flex h-[56px] w-full min-w-0 items-center overflow-hidden rounded-[10px] pr-3 md:h-full"
      style={{
        background: `linear-gradient(100deg, ${bg}, ${bg}cc)`,
        border: "2px solid #0a1120",
        boxShadow: "3px 4px 0 #05090f",
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
          // 1.5x the plate's height, and square with it, so it grows when
          // the row does. Big enough to run past the photo's right edge
          // and under the start of the name - which is the point -
          // without losing so much of the crest off the top and bottom
          // that it stops being recognisable. The plate clips it, the
          // photo does not.
          className="pointer-events-none absolute left-[-8px] top-1/2 aspect-square h-[150%] max-w-none -translate-y-1/2 select-none object-contain opacity-[0.26]"
        />
      )}

      {/* Square, full-bleed, and the plate's own rounded corners do the
          clipping - so no radius here, or the corners double up. */}
      <span
        className="relative grid aspect-square h-full shrink-0 place-items-center overflow-hidden text-lg font-extrabold"
        style={{ color: ink }}
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
        className="relative ml-2.5 min-w-0 truncate text-[15px] font-semibold md:ml-3 md:text-[13px] lg:text-[15px]"
        style={{ color: ink, textShadow: ink === "#ffffff" ? "0 1px 2px rgba(0,0,0,0.45)" : "none" }}
      >
        {name}
      </span>
    </span>
  );
}
