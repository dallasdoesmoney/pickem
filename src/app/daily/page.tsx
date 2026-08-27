"use client";

import { useAuth } from "@/hooks/useAuth";
import { DailyPuzzle } from "@/components/DailyPuzzle";

// Widens in two steps rather than one. A phone stacks each guess into its
// own card and wants the narrow column; a desktop lays the same guess out
// as a row of eight hints and needs the room, which is what it was not
// getting when this was max-w-lg at every size - the board could not fit
// and grew a horizontal scrollbar instead.
//
// Back to 4xl from 5xl, because the board lost a column. Six chips
// divide the same width seven used to, so at 5xl they came out at 107px
// to hold "QB" - a row of mostly-empty cards stretched across a monitor,
// which is the exact thing the cap exists to stop. At 4xl they are 87px
// holding 16px type, which is more chip AND more type than the seven-wide
// board ever had.
//
// Re-measure this whenever a column is added or removed: the chips are
// 1fr tracks, so the right page width is a function of how many of them
// there are.
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
      {/* The title is centred on the CARD, and the mark is taken out of
          the centring and parked on the left. Centring the pair meant the
          title sat off the card's axis by half the logo plus the gap -
          about 54px - so it never lined up with the guess field directly
          beneath it, which is the one thing on this screen it ought to
          line up with. Absolute, so the logo's width cannot push it. */}
      <div className="relative flex justify-center px-3 pb-2.5 pt-3 sm:px-4">
        {/* The block shrinks to the title, and the mark hangs off its left
            edge - right-full, so it sits against the title wherever the
            title happens to be rather than against the card. Pinned to
            the card's left edge instead, it drifted a hundred pixels away
            from the thing it belongs to and read as a stray nav item.
            bottom-0 puts its feet on the same line as the subtitle.
            Absolute, so it still takes no part in the centring: the title
            stays on the card's axis, over the guess field. */}
        {/* min-h and justify-end are what stop the mark hanging out of the
            top of the card. Absolute means it no longer pushes the header
            open the way it did in flow, so the block reserves its height
            instead and sits its own content on the bottom edge - which is
            also what puts the subtitle and the cup on one line. */}
        <div className="relative flex min-h-16 min-w-0 flex-col justify-end text-center sm:min-h-[92px]">
          <img
            src="/press-logo.png"
            alt="Sideline Brew"
            // 76 rather than the 92 it was. The mark used to be in flow,
            // so the header grew to hold it for free; now that it is
            // absolute, every pixel of it is a pixel of header that has
            // to be reserved - and this header has been cut twice
            // already. 76 still reads as the big version next to a 48px
            // title and costs six pixels of height rather than twenty-six.
            className="absolute bottom-0 right-full mr-2 h-16 w-16 sm:mr-4 sm:h-[92px] sm:w-[92px]"
            style={{ objectFit: "contain" }}
          />
          {/* The "DAILY GAME" eyebrow is gone: the line under the title
              already says what kind of thing this is, and the card on the
              home page is captioned DAILY GAME too, so it was the third
              time in two screens. */}
          <h1
            className="text-[clamp(1.75rem,7vw,3.1rem)] leading-none tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            NAMEPLATE
          </h1>
          <p className="mt-1 truncate text-xs leading-tight text-white/45 sm:text-[15px]">NFL Guessing Game</p>
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
