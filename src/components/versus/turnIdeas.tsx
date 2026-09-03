"use client";

import type { AuctionFormat } from "@/lib/auction/format";
import { type AuctionState, toAct } from "@/lib/auction/engine";
import { PLAYER_COLORS } from "./style";

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
// AND IT COSTS NO HEIGHT. The band between two cameras is the whole
// canvas and every pixel is somebody's face, so the mark is absolutely
// positioned inside a box that already exists. The graphic is exactly as
// tall with it up as without - measured, at 469 stage px either way.
//
// Chosen out of five: a caret pointing at the logo, a ring around the
// badge, a TO OPEN tag above the name, and the name itself glowing.
// The rule won for being the one that reads fastest on a still frame -
// a line under a name is the oldest way there is of saying "this one".

// Who is on the clock, but only while it is still the opening move.
// `state.bid` being set is what ends it: from then on the price under
// the logo is already in somebody's colour, and a second indicator on
// top of that is two things arguing about the same fact.
export function onTheClock(state: AuctionState, format: AuctionFormat): number | null {
  if (state.phase !== "bidding" || state.bid) return null;
  return toAct(state, format);
}

// The mark that hangs off the NAME. Absolute, so the name row is the
// same height whether it is up or not.
export function TurnNameMark({ who }: { who: number }) {
  // The OUTER end, so it underlines the name rather than the budget
  // beside it - the name is what it is naming.
  const outer = who === 0 ? "left" : "right";
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
        background: PLAYER_COLORS[who],
        boxShadow: "0 2px 0 rgba(5,7,13,0.8)",
      }}
    />
  );
}
