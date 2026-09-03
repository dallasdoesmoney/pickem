"use client";

import type { AuctionFormat } from "@/lib/auction/format";
import { type AuctionState, toAct } from "@/lib/auction/engine";
import { PLAYER_COLORS, outlined } from "./style";

// WHOSE TURN IT IS, BEFORE ANYBODY HAS BID.
//
// The model has always known - headline() builds the string "NOAH TO
// OPEN" out of toAct() - but the spine layout never draws it. It draws
// the money and drops the words, so the one moment on the board with no
// number in it is also the one moment with nothing on it.
//
// ONLY BEFORE THE FIRST BID. Once a bid is standing, the price is
// already in the bidder's colour under the logo and it says whose move
// it is by saying whose money it is; a second indicator on top of that
// is two things arguing about the same fact. So every one of these
// switches off the instant somebody bids.
//
// AND NONE OF THEM COST HEIGHT. The band between two cameras is the whole
// canvas and every pixel is somebody's face, so all five are absolutely
// positioned inside boxes that already exist, or they are a change to
// something already being drawn. The graphic is exactly as tall with an
// indicator up as without.

export type TurnKey = "rule" | "caret" | "ring" | "tag" | "breath";

export const TURN_IDEAS: { key: TurnKey; name: string; note: string }[] = [
  {
    key: "rule",
    name: "1 · Rule",
    note: "A short bar in the player's colour, under their name. The quietest of the five and the one that reads fastest at a glance - a line under a name is the oldest way there is of saying \"this one\". Costs nothing and cannot be missed on a still frame.",
  },
  {
    key: "caret",
    name: "2 · Caret",
    note: "A small triangle in the player's colour on the inner end of their name, pointing at the logo. It says whose turn it is AND what they are turning to - the direction is the message, so it works even for somebody who has just tuned in and does not know the two colours yet.",
  },
  {
    key: "ring",
    name: "3 · Ring",
    note: "The logo takes a ring in the player's colour, heaviest on their side. The indicator lives on the thing everybody is already looking at rather than off at the edge - but it is the most decorative of the five, and on a busy badge it is the one most likely to read as part of the crest.",
  },
  {
    key: "tag",
    name: "4 · Tag",
    note: "A small TO OPEN in their colour, above their name, in the exact slot the winning bid flies into later - free real estate at this moment, because nothing has been won yet. The only one that says it in words, which is the only one a new viewer needs no explanation for.",
  },
  {
    key: "breath",
    name: "5 · Breath",
    note: "Nothing is added at all: their name glows in its own colour and slowly breathes. The subtlest by a distance, and the only one that survives a screenshot badly - on a still frame at the wrong moment it is nearly invisible.",
  },
];

export const DEFAULT_TURN: TurnKey = "rule";

export function isTurnKey(value: string | null): value is TurnKey {
  return value !== null && TURN_IDEAS.some((i) => i.key === value);
}

// Who is on the clock, but only while it is still the opening move.
// `state.bid` being set is what ends it: from then on the price under
// the logo is already in somebody's colour.
export function onTheClock(state: AuctionState, format: AuctionFormat): number | null {
  if (state.phase !== "bidding" || state.bid) return null;
  return toAct(state, format);
}

// The keyframes, once. Two of the five move, and both move slowly: a
// hard motion on a stream graphic reads as a glitch, and this is meant
// to be noticed rather than watched.
export function TurnStyles() {
  return (
    <style>{`
      @keyframes versusTurnBreath {
        0%, 100% { opacity: 0.55; }
        50%      { opacity: 1; }
      }
      @keyframes versusTurnGlow {
        0%, 100% { text-shadow: 0 3px 0 rgba(5,7,13,0.85); }
        50%      { text-shadow: 0 3px 0 rgba(5,7,13,0.85), 0 0 18px currentColor; }
      }
      .versus-turn-breath { animation: versusTurnBreath 2.4s ease-in-out infinite; }
      .versus-turn-glow   { animation: versusTurnGlow 2.4s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .versus-turn-breath, .versus-turn-glow { animation: none; }
      }
    `}</style>
  );
}

// Everything that hangs off the NAME. Absolute in every case, so the
// name row is the same height whether one of these is up or not.
export function TurnNameMark({ kind, who }: { kind: TurnKey; who: number }) {
  const color = PLAYER_COLORS[who];
  // Outer end for the rule (it should underline the whole name), inner
  // end for the caret (it points at the logo, which is inward).
  const outer = who === 0 ? "left" : "right";
  const inner = who === 0 ? "right" : "left";

  if (kind === "rule") {
    return (
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "100%",
          marginTop: 4,
          [outer]: 0,
          width: "72%",
          height: 6,
          borderRadius: 3,
          background: color,
          boxShadow: "0 2px 0 rgba(5,7,13,0.8)",
        }}
      />
    );
  }

  if (kind === "caret") {
    return (
      <span
        aria-hidden
        className="versus-turn-breath"
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          // Outside the row's own box, in the gap before the logo, so it
          // never pushes the name or the budget along.
          [inner]: -30,
          width: 0,
          height: 0,
          borderTop: "13px solid transparent",
          borderBottom: "13px solid transparent",
          [who === 0 ? "borderLeft" : "borderRight"]: `18px solid ${color}`,
          filter: "drop-shadow(0 2px 0 rgba(5,7,13,0.8))",
        }}
      />
    );
  }

  if (kind === "tag") {
    return (
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: "100%",
          marginBottom: 4,
          [outer]: 0,
          fontFamily: "var(--font-display)",
          fontSize: 20,
          lineHeight: 1,
          letterSpacing: 3,
          color,
          whiteSpace: "nowrap",
          ...outlined(20),
        }}
      >
        TO OPEN
      </span>
    );
  }

  return null;
}

// The class the NAME ITSELF takes, for the one variant that changes the
// name rather than adding to it.
export function turnNameClass(kind: TurnKey, isClock: boolean): string {
  return kind === "breath" && isClock ? "versus-turn-glow" : "";
}

// The ring around the lot logo. Heaviest on the active player's side, so
// it says WHO as well as "somebody" - a plain ring would only say the
// second thing.
export function TurnLogoRing({ kind, who, size }: { kind: TurnKey; who: number; size: number }) {
  if (kind !== "ring") return null;
  const color = PLAYER_COLORS[who];
  return (
    <span
      aria-hidden
      className="versus-turn-breath"
      style={{
        position: "absolute",
        // Outside the badge, so it frames rather than crops it.
        inset: -10,
        borderRadius: "50%",
        border: `6px solid ${color}33`,
        // Only the active player's side at full strength. A conic or a
        // gradient border would need a pseudo-element; two border colours
        // is the same effect in one box.
        [who === 0 ? "borderLeftColor" : "borderRightColor"]: color,
        [who === 0 ? "borderTopColor" : "borderBottomColor"]: `${color}aa`,
        width: size + 20,
        height: size + 20,
        boxShadow: `0 0 14px ${color}55`,
      }}
    />
  );
}
