"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { DailyPuzzle } from "@/components/DailyPuzzle";

// Widens in two steps rather than one. A phone stacks each guess into its
// own card and wants the narrow column; a desktop lays the same guess out
// as a row of eight hints and needs the room, which is what it was not
// getting when this was max-w-lg at every size - the board could not fit
// and grew a horizontal scrollbar instead.
export default function DailyPage() {
  const { user, loading } = useAuth();

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
      <div
        className="flex items-center justify-center gap-3 rounded-2xl px-3 py-2.5 text-center sm:gap-4 sm:px-4"
        style={{ border: "1px solid rgba(143,164,196,0.4)", background: "linear-gradient(180deg, #12203a, #0b1730)" }}
      >
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
      ) : user ? (
        <DailyPuzzle header={header} />
      ) : (
        <>
          {header}
          {/* Signed out gets the pitch rather than a wall. The guesses
              have to be recorded against someone - eight tries only means
              anything if they cannot be reset by reloading. */}
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
          <span className="text-3xl">🧠</span>
          <p className="text-base text-white">A new player every day</p>
          <p className="max-w-xs text-sm text-white/50">
            {/* No points figure here on purpose. "Pays up to 300 a day"
                reads like cash to somebody who has not yet learned what
                points are in this app, and a free game that looks like it
                is offering money is a game people bounce off. */}
            Eight guesses, and every one tells you something. Create a free profile to play — it keeps your streak going
            day to day.
          </p>
          <Link
            href="/account"
            className="mt-3 rounded-full px-6 py-2.5 text-sm active:scale-95 transition-transform duration-150"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            CREATE A PROFILE
          </Link>
          </div>
        </>
      )}
    </main>
  );
}
