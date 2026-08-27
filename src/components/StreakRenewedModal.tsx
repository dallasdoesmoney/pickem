"use client";

import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

// The moment the streak ticks over, once a day.
//
// It fires off `awarded` from daily_check_in(), which the DATABASE decides
// - the second call of a day comes back awarded: false - so this cannot be
// made to appear twice by reloading, and cannot be missed by a client with
// the wrong idea of what day it is. See
// supabase/migrations/0041_daily_check_in.sql.
//
// The number CHANGES in front of you rather than simply being stated:
// yesterday's count is thrown up and out as today's arrives from below.
// That is the whole point of the thing. A total on its own is a fact; a
// total replacing the one before it is the streak advancing, and the
// advancing is what anybody came back for.

// Embers, laid out on a circle. Fixed rather than random so every player
// sees the same burst and so a re-render mid-animation cannot reshuffle
// them - Math.random() here would restart the effect on every paint.
const EMBERS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 + 0.4;
  const distance = 64 + (i % 3) * 22;
  return {
    x: Math.round(Math.cos(angle) * distance),
    // Biased upward: embers rise.
    y: Math.round(Math.sin(angle) * distance - 24),
    delay: 240 + i * 34,
    hot: i % 2 === 1,
  };
});

export function StreakRenewedModal({
  streak,
  points,
  longest,
  onClose,
}: {
  streak: number;
  points: number;
  longest: number;
  onClose: () => void;
}) {
  // Escape closes it, like every other dismissible surface in the app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const copy = useMemo(() => {
    // Day one has no streak to RENEW - there is nothing to count up from,
    // and "1 day in a row" is not a run, it is attendance. Same line the
    // leaderboard badge draws at MIN_VISIBLE, for the same reason.
    if (streak <= 1) {
      return { kicker: "Day 1", headline: "Streak started", sub: "Come back tomorrow to make it two." };
    }
    // longest comes back already updated, so matching it means today set
    // it - see v_longest := greatest(...) in the migration.
    if (streak >= longest) {
      return {
        kicker: `Day ${streak}`,
        headline: "Personal best",
        sub: `${streak} days straight — the longest you have ever gone.`,
      };
    }
    if (streak === 7) return { kicker: "Day 7", headline: "Streak alive", sub: "One week straight. Back tomorrow to make it eight." };
    return {
      kicker: `Day ${streak}`,
      headline: "Streak alive",
      sub: `${streak} days in a row. Longest so far: ${longest}.`,
    };
  }, [streak, longest]);

  // There is no document on the server. In practice this never renders
  // there - it only mounts once daily_check_in() has answered, which is
  // after hydration - but a component that takes the server down when
  // somebody renders it a little differently is a trap, and a portal
  // contributes nothing where it is called either way, so returning null
  // here costs nothing.
  if (typeof document === "undefined") return null;

  // Portalled to the body, NOT rendered where it is called. The toasts
  // this sits beside live inside the header, and the header has a
  // backdrop-filter on it - which makes it the containing block for any
  // fixed-position descendant, so `fixed inset-0` would resolve to the
  // header's own 72px box instead of the viewport and the modal would
  // land off the top of the screen with the page undimmed behind it.
  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="streak-renewed-title"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="streak-scrim absolute inset-0 cursor-default bg-[rgba(3,6,12,0.82)]"
      />

      <div className="streak-card relative w-full max-w-[340px] rounded-[20px] border border-[#24344f] bg-[#101a2e] px-5 pb-5 pt-7 text-center shadow-[0_30px_60px_-24px_#000]">
        {/* Embers escape the card, so they are not clipped by it. */}
        <span aria-hidden className="pointer-events-none absolute inset-0">
          {EMBERS.map((e, i) => (
            <span
              key={i}
              className="streak-ember"
              style={
                {
                  ["--ex"]: `${e.x}px`,
                  ["--ey"]: `${e.y}px`,
                  animationDelay: `${e.delay}ms`,
                  background: e.hot ? "#ff5b2e" : "#fb923c",
                } as React.CSSProperties
              }
            />
          ))}
        </span>

        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{copy.kicker}</p>
        <h2
          id="streak-renewed-title"
          className="mt-1 text-[1.15rem] leading-tight text-white"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {copy.headline}
        </h2>

        <span className="relative mt-1.5 inline-flex items-center justify-center leading-none">
          <span aria-hidden className="streak-flame block text-[92px] leading-none">
            🔥
          </span>
          {/* Three digits step down a size, the same rule and the same
              reason as the leaderboard's badge: at the full size "128"
              spills past the flame's base and stops reading as part of
              it. Measured here too, not assumed - 34px overhangs, 26 sits
              inside the glyph. */}
          <span
            aria-hidden
            className={`absolute inset-0 flex items-end justify-center whitespace-nowrap pb-[7px] font-extrabold tabular-nums text-white ${
              streak >= 100 ? "text-[26px]" : "text-[34px]"
            }`}
            style={{ textShadow: "0 1px 3px #000, 0 0 5px #000, 0 0 8px rgba(0,0,0,.9)" }}
          >
            {/* Yesterday's number is drawn on top of today's and thrown
                out from under it. Absolute so the two never take up two
                slots' worth of width mid-swap. */}
            {streak > 1 && <span className="streak-old absolute">{streak - 1}</span>}
            <span className="streak-new">{streak}</span>
          </span>
        </span>

        <p className="mt-1.5 text-xs text-white/45">{copy.sub}</p>

        <span
          className="streak-pts mt-3.5 inline-block rounded-full bg-[#4ade80] px-4 py-1.5 text-[0.78rem] text-[#04240f]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          +{points} PTS
        </span>

        <button
          type="button"
          onClick={onClose}
          className="mt-3.5 block w-full rounded-full border border-white/10 py-2.5 text-[0.72rem] text-white/50 transition-colors hover:border-white/25 hover:text-white/80"
          style={{ fontFamily: "var(--font-display)" }}
        >
          NICE
        </button>
      </div>
    </div>,
    document.body
  );
}
