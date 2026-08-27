"use client";

import { useAuth } from "@/hooks/useAuth";
import { DailyPuzzle } from "@/components/DailyPuzzle";

// Widens in two steps rather than one. A phone stacks each guess into its
// own card and wants the narrow column; a desktop lays the same guess out
// as a row of eight hints and needs the room, which is what it was not
// getting when this was max-w-lg at every size - the board could not fit
// and grew a horizontal scrollbar instead.
//
// It stops at 4xl rather than running on to 6xl. The chips are 1fr tracks,
// so they divide whatever width they are handed: on a wide screen they were
// growing to 116px to hold values like "QB" and "26" - a board of
// mostly-empty cards stretched across the monitor. Capped, they measure
// 79px, which still fits every value on one line except the long colleges,
// and those wrap to two ("Mississippi State" is the worst case and it fits
// in the row's existing height).
//
// 4xl is the floor, not a preference. One step further down, at 3xl, the
// chips come out at 61px and "NFC North" - which truncates rather than
// wraps - loses its tail. Measured, not guessed; re-measure if the chip
// type sizes change.
//
// A shorter line is easier to read across anyway: seven hints you can take
// in without moving your head beats seven you have to scan.
export default function DailyPage() {
  const { loading } = useAuth();

  // Built here and handed to the game, because where it belongs depends
  // on something only the game knows: once there is a result, the result
  // goes above the title.
  const header = (
    <>
      {/* The title ends up in every clip anyone records of this, so the
          mark has to be IN it rather than in the nav bar that gets cropped
          off. A bar rather than a stack: the logo sits in rows the title
          already occupies, so a 92px cup costs nothing - stacking it above
          the title would have added 84px, most of a guess row.
          The eyebrow and tagline live inside the bar for the same reason,
          and the whole header is shorter than the wordmark-only version it
          replaces. */}
      {/* No box of its own any more. The title, the guess field and the
          board were three separate bordered cards floating on the page,
          which made one activity look like three unrelated widgets. The
          game owns a single card now and this is its top section - so
          the header brings padding and nothing else, and the rule under
          it is what separates it from the field. */}
      {/* items-END, not items-center. The cup is 92px and the type block
          is about 55, so centring the two left the title floating in the
          middle of the logo with air above and below it. Sitting them on
          a common baseline drops the title to where the cup's own
          wordmark is and takes the slack out of the whole header. */}
      <div className="flex items-end justify-center gap-3 px-3 pb-2.5 pt-3 text-center sm:gap-4 sm:px-4">
        <img
          src="/press-logo.png"
          alt="Sideline Brew"
          className="h-16 w-16 shrink-0 sm:h-[92px] sm:w-[92px]"
          style={{ objectFit: "contain" }}
        />
        {/* The block shrinks to the title's width, so "centred" and
            "left" mean the same thing for NAMEPLATE itself - what this
            decides is where the shorter line under it sits, and that is
            set on the line rather than here. */}
        <div className="min-w-0">
          {/* The "DAILY GAME" eyebrow is gone: the line under the title
              already says what kind of thing this is, and the card on the
              home page is captioned DAILY GAME too, so it was the third
              time in two screens. */}
          <h1
            className="text-[clamp(1.6rem,7vw,2.4rem)] leading-none tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            NAMEPLATE
          </h1>
          {/* Centred under the title, not ranged left with it. The type
              block is exactly as wide as NAMEPLATE, so this centres on
              the title's own axis - which is what you want from a line
              that is a subtitle to it rather than a second line of it. */}
          <p className="mt-0.5 truncate text-center text-[11px] leading-tight text-white/45 sm:text-[13px]">
            NFL Guessing Game
          </p>
        </div>
      </div>
    </>
  );

  return (
    <main className="flex-1 px-4 pb-16 pt-6 max-w-lg md:max-w-3xl lg:max-w-4xl w-full mx-auto">
      {loading ? (
        <>
          {header}
          <div className="flex justify-center py-16">
            <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        </>
      ) : (
        // No wall. Anybody can play; the board keeps a signed-out run in
        // the browser and hands it over if they sign up, and the ask
        // arrives at the third guess rather than at the door. Asking for
        // an account before somebody has seen what the game is was the
        // most expensive thing on this page.
        <DailyPuzzle header={header} />
      )}
    </main>
  );
}
