"use client";

import { useEffect, useRef, useState } from "react";

// THE MOMENTS THAT DID NOT MOVE.
//
// The graphic had three moving parts: the reel spinning, a pick landing
// on a roster, and the winning price flying to the winner - which left
// the moments that happen MOST with nothing on them at all. These are
// the three that fill them in:
//
//   the bid bump   the number under the logo punches when it changes
//   the landing    the reel stops on an overshoot, and a ring pulses out
//   the drain      the winner's budget counts down instead of snapping
//
// Chosen out of four. The fourth was a SOLD stamp slamming over the logo
// - dropped because the winning price is already flying to the winner at
// that exact moment, and two things arriving on the same beat is one too
// many for a graphic sitting over somebody's face.
//
// Everything here is transform and opacity only, so none of it costs a
// pixel of height or reflows anything. And everything is keyed on a
// STATE VALUE rather than fired by an event: the overlay is handed whole
// states over a broadcast and has to infer "something just happened", so
// a duplicate state - an OBS reconnect, a re-broadcast - must not replay
// an animation. A React key on the value does that for free: same value,
// same element, no remount, no replay.

// All of it, once. Every duration is 300ms or more and eased: a hard
// snap at stream framerates reads as a dropped frame rather than as
// motion.
export function AnimStyles() {
  return (
    <style>{`
      @keyframes versusBidBump {
        0%   { transform: scale(1); }
        35%  { transform: scale(1.34); }
        100% { transform: scale(1); }
      }
      @keyframes versusLandSettle {
        0%   { transform: scale(1.16); }
        45%  { transform: scale(0.965); }
        75%  { transform: scale(1.012); }
        100% { transform: scale(1); }
      }
      @keyframes versusLandRing {
        0%   { opacity: 0.75; transform: scale(0.82); }
        100% { opacity: 0;    transform: scale(1.85); }
      }
      .versus-bump { animation: versusBidBump 420ms cubic-bezier(0.2,1.5,0.35,1) both; }
      .versus-land { animation: versusLandSettle 480ms cubic-bezier(0.25,1.2,0.35,1) both; }
      .versus-ring { animation: versusLandRing 620ms cubic-bezier(0.2,0.7,0.3,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .versus-bump, .versus-land, .versus-ring { animation: none; }
      }
    `}</style>
  );
}

// The ring that pulses out of the badge as the reel lands.
export function LandRing({ size, color }: { size: number; color: string }) {
  return (
    <span
      aria-hidden
      className="versus-ring"
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderRadius: "50%",
        border: `6px solid ${color}`,
        pointerEvents: "none",
      }}
    />
  );
}

// A NUMBER THAT COUNTS RATHER THAN JUMPS.
//
// Only downward, and only when the drop is real: a budget goes from $20
// to $14 the instant a lot is won, which is the most expensive thing
// that happens to a player all game and currently reads as a typo. It
// counts UP instantly - there is no such thing as a budget rising in
// this game, so an upward move is a new draft or a reconnect, and
// animating those would be a lie about what just happened.
export function useDrain(target: number, ms = 620): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (target >= from.current) {
      from.current = target;
      setShown(target);
      return;
    }
    const start = from.current;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      // Ease out. The interesting part of a drain is the beginning -
      // how far it fell - not the last dollar.
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (target - start) * eased));
      if (p < 1) raf.current = requestAnimationFrame(step);
      else from.current = target;
    };
    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      // Whatever happens, the number ends up correct. An interrupted
      // drain must not leave a budget reading something that was true
      // for 200ms in the middle of an animation.
      from.current = target;
    };
  }, [target, ms]);

  return shown;
}
