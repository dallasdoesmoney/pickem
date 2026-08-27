"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

// The ask, at the third guess, to somebody who has not signed up.
//
// It arrives at three because that is the first moment a guest has
// something to lose: enough of a board to have seen what the game is, and
// far enough from the end that the ask is not catching them on the way
// out of the door.
//
// The mug is the argument. It fills to however far through the run the
// player actually is, so the picture is a progress bar rather than a
// decoration - and it is the half of "Sideline Brew" that no other
// football site can copy.
//
// No points figure anywhere in the copy. "Pays up to 300 a day" reads as
// cash to anybody who has not yet learned what points are here, and a
// free game that looks like it is offering money is one people bounce
// off. The streak is the honest thing at stake.

// The mug's inside, in the drawing's own coordinates. The coffee is a
// rect clipped to this and slid up from below, so the surface RISES
// rather than the shape inflating from its base.
const RIM = 34;
const BASE = 95;
const CAVITY = "M28 34 h60 l-6 52 a10 10 0 0 1 -10 9 h-28 a10 10 0 0 1 -10 -9 z";

export function StillBrewingModal({
  used,
  max,
  onClose,
}: {
  used: number;
  max: number;
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

  if (typeof document === "undefined") return null;

  const surface = Math.round(BASE - (BASE - RIM) * Math.min(1, used / max));
  const drop = 110 - surface;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-labelledby="brewing-title">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="brew-scrim absolute inset-0 cursor-default bg-[rgba(3,6,12,0.82)]"
      />

      <div
        className="brew-card relative w-full max-w-[340px] rounded-[18px] border-2 border-[#0a1120] bg-[#141d31] px-5 pb-5 pt-6 text-center"
        style={{ boxShadow: "5px 6px 0 #05090f" }}
      >
        <svg viewBox="0 -6 116 116" className="mx-auto block w-[116px]" aria-hidden style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="brew-ceramic" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#c3cddc" />
              <stop offset="1" stopColor="#8d9bb2" />
            </linearGradient>
            <linearGradient id="brew-coffee" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a86b3d" />
              <stop offset="1" stopColor="#5f371d" />
            </linearGradient>
            <clipPath id="brew-inside">
              <path d={CAVITY} />
            </clipPath>
          </defs>

          {[0, 0.5, 1].map((delay, i) => (
            <g key={i} className="brew-wisp" style={{ animationDelay: `${delay}s` }}>
              <path
                d={`M${[45, 58, 71][i]} ${[26, 22, 26][i]} c-5 -${[7, 8, 7][i]} 5 -${[11, 12, 11][i]} 0 -${[19, 20, 19][i]}`}
                stroke="#ffffff"
                strokeOpacity="0.55"
                strokeWidth="4"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          ))}

          {/* Thick enough to read as the same ceramic the body is made
              of. Drawn as a fat dark stroke with a thinner light one on
              top, which is the outline-plus-fill the chips use. */}
          <path d="M86 46 h6 a17 17 0 0 1 0 30 h-8" fill="none" stroke="#0a1120" strokeWidth="18" strokeLinecap="round" />
          <path d="M86 46 h6 a17 17 0 0 1 0 30 h-8" fill="none" stroke="url(#brew-ceramic)" strokeWidth="10" strokeLinecap="round" />

          <path
            d="M26 32 h64 l-7 55 a12 12 0 0 1 -12 11 h-26 a12 12 0 0 1 -12 -11 z"
            fill="url(#brew-ceramic)"
            stroke="#0a1120"
            strokeWidth="5"
            strokeLinejoin="round"
          />

          <g clipPath="url(#brew-inside)">
            <rect
              className="brew-liquid"
              x="20"
              y={surface}
              width="80"
              height={drop}
              fill="url(#brew-coffee)"
              style={{ ["--drop" as string]: `${drop}px` }}
            />
          </g>

          {/* The rim, so you can see down into it rather than at a
              silhouette. */}
          <ellipse cx="58" cy="33" rx="32" ry="8" fill="#0e1626" stroke="#0a1120" strokeWidth="5" />
          <ellipse cx="58" cy="33" rx="26" ry="5" fill="#1b2740" />
          <path d="M22 104 h72" stroke="#0a1120" strokeWidth="5" strokeLinecap="round" />
        </svg>

        <p className="mt-2 text-[12px] tracking-[0.05em] text-[#fb923c]" style={{ fontFamily: "var(--font-display)" }}>
          {used} OF {max} POURED
        </p>
        <h2 id="brewing-title" className="mt-1.5 text-[17px] leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
          Your streak is brewing
        </h2>
        <p className="mx-auto mt-2 max-w-[15rem] text-[12.5px] leading-relaxed text-white/55">
          Nothing is saved yet. Make a free account and every morning from here counts toward the streak.
        </p>

        <Link
          href="/account"
          className="mt-4 block w-full rounded-full py-3 text-[11.5px] tracking-[0.04em] transition-transform duration-150 active:scale-95"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#06240f" }}
        >
          SAVE MY BREW
        </Link>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 block w-full py-1 text-[12px] text-white/45 transition-colors hover:text-white/70"
        >
          Not yet
        </button>
      </div>
    </div>,
    document.body
  );
}
