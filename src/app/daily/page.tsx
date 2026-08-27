"use client";

import { useAuth } from "@/hooks/useAuth";
import { DailyPuzzle } from "@/components/DailyPuzzle";

// Widens in two steps rather than one. A phone stacks each guess into its
// own card and wants the narrow column; a desktop lays the same guess out
// as a row of eight hints and needs the room, which is what it was not
// getting when this was max-w-lg at every size - the board could not fit
// and grew a horizontal scrollbar instead.
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
      <div className="flex items-center justify-center gap-3 px-3 py-3 text-center sm:gap-4 sm:px-4">
        <img
          src="/press-logo.png"
          alt="Sideline Brew"
          className="h-16 w-16 shrink-0 sm:h-[92px] sm:w-[92px]"
          style={{ objectFit: "contain" }}
        />
        {/* Left-aligned inside a centred pair: the logo and the type read
            as one lockup that happens to sit in the middle, where
            centring the text as well would leave the eyebrow and the
            tagline drifting on their own axes under a title of a
            different width. */}
        <div className="min-w-0 text-left">
          <div className="text-[10px] tracking-[0.25em] text-white/45 sm:text-xs">DAILY GAME</div>
          <h1
            className="text-[clamp(1.6rem,7vw,2.4rem)] leading-none tracking-wide"
            style={{ fontFamily: "var(--font-display)" }}
          >
            NAMEPLATE
          </h1>
          <p className="mt-1 truncate text-[11px] text-white/45 sm:text-[13px]">
            One mystery player a day. Same player for everyone.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <main className="flex-1 px-4 pb-16 pt-6 max-w-lg md:max-w-3xl lg:max-w-5xl xl:max-w-6xl w-full mx-auto">
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
