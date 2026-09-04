"use client";

import { useEffect, useRef, useState } from "react";
import { PLAYER_COLORS } from "./style";

// THE MOMENTS THAT DO NOT MOVE.
//
// The graphic has three moving parts today: the reel spinning, a pick
// landing on a roster, and the winning price flying to the winner. Which
// leaves the parts that happen MOST with nothing on them at all - the
// number changing, the sale, and the end of the spin.
//
// Everything here is transform and opacity only, so none of it costs a
// pixel of height or reflows anything. And everything is keyed on a
// STATE VALUE rather than fired by an event: the overlay is handed whole
// states over a broadcast and has to infer "something just happened", so
// a duplicate state - an OBS reconnect, a re-broadcast - must not replay
// an animation. A React key on the value does that for free: same value,
// same element, no remount, no replay.

export type AnimKey = "bump" | "sold" | "land" | "drain";

export const ANIMS: { key: AnimKey; name: string; note: string }[] = [
  {
    key: "bump",
    name: "1 · Bid bump",
    note: "The number under the logo punches when it changes. Right now $3 becomes $4 and swaps colour with no motion at all - on a re-watch you can miss a raise entirely, and the back-and-forth IS the game. Cheapest of the four and the one that fires most often.",
  },
  {
    key: "sold",
    name: "2 · SOLD",
    note: "A stamp slams over the logo in the winner's colour and fades. An auction's signature beat, and right now the sale is just a price quietly flying away. This is the moment you would cut to in a clip.",
  },
  {
    key: "land",
    name: "3 · The landing",
    note: "The reel spins for two and a quarter seconds building anticipation and then simply stops. The logo overshoots and settles, and a ring pulses out in the team's colour - paying off the wind-up instead of dropping it.",
  },
  {
    key: "drain",
    name: "4 · Budget drain",
    note: "The winner's money counts down instead of snapping from $20 to $14. Makes the cost land, and it is the number that decides the endgame. The quietest of the four, and the only one that is about the consequence rather than the moment.",
  },
];

export function has(anims: AnimKey[] | undefined, key: AnimKey): boolean {
  return !!anims && anims.includes(key);
}

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
      @keyframes versusSoldIn {
        0%   { opacity: 0; transform: scale(2.1) rotate(-16deg); }
        22%  { opacity: 1; transform: scale(0.94) rotate(-9deg); }
        32%  { transform: scale(1.04) rotate(-11deg); }
        45%  { transform: scale(1) rotate(-10deg); }
        78%  { opacity: 1; transform: scale(1) rotate(-10deg); }
        100% { opacity: 0; transform: scale(1.12) rotate(-10deg); }
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
      .versus-sold { animation: versusSoldIn 1150ms cubic-bezier(0.2,0.9,0.25,1) both; }
      .versus-land { animation: versusLandSettle 480ms cubic-bezier(0.25,1.2,0.35,1) both; }
      .versus-ring { animation: versusLandRing 620ms cubic-bezier(0.2,0.7,0.3,1) both; }
      @media (prefers-reduced-motion: reduce) {
        .versus-bump, .versus-sold, .versus-land, .versus-ring { animation: none; }
      }
    `}</style>
  );
}

// The stamp, over the logo, in the winner's colour. Absolute and
// pointer-events-none: it is drawn ON the lot for a beat and then gone,
// and nothing under it moves.
export function SoldStamp({ who, size }: { who: number; size: number }) {
  return (
    <span
      aria-hidden
      className="versus-sold"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
        zIndex: 3,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-display)",
          // Sized off the logo rather than fixed, so it stays right if
          // the lot is ever resized again.
          fontSize: size * 0.34,
          letterSpacing: 4,
          lineHeight: 1,
          padding: `${size * 0.05}px ${size * 0.11}px`,
          color: "#ffffff",
          background: PLAYER_COLORS[who],
          border: `${Math.max(3, size * 0.022)}px solid #05070d`,
          borderRadius: 10,
          boxShadow: "0 6px 0 rgba(5,7,13,0.75)",
          WebkitTextStroke: "2px #05070d",
          paintOrder: "stroke fill",
        }}
      >
        SOLD
      </span>
    </span>
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
