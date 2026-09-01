// The wire between the board and the overlay.
//
// Two things can go wrong here that no amount of looking at the screen
// would catch, because both only show up on somebody else's machine mid
// stream:
//
//   1. The state does not survive JSON. The engine builds plain objects
//      today, but a Set, a Map, a Date or an undefined slipped into it
//      later would cross the wire as something subtly different, and the
//      overlay would draw a draft that is not the one being played.
//   2. The overlay draws a message it should have dropped. Anything at
//      all can arrive on a channel; a crashed browser source is a black
//      hole in the middle of a live stream.

import assert from "node:assert/strict";
import { AUCTION_FORMATS } from "../src/lib/auction/formats.ts";
import { startAuction, openLot, reduce, toAct, bidRange, currentItem, openSlots, slotsItemCanFill } from "../src/lib/auction/engine.ts";
import { newRoomCode, isRoomCode, roomChannel, isBoardMessage } from "../src/lib/auction/room.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

// ---- the code itself ----------------------------------------------------

const codes = Array.from({ length: 5000 }, newRoomCode);
ok("every code is 10 characters", codes.every((c) => c.length === 10));
ok("every code passes its own validator", codes.every(isRoomCode));
ok(
  "no ambiguous characters",
  codes.every((c) => !/[01lIO]/.test(c)),
  "0/1/l/I/O are excluded so a code can be read off a screen",
);
ok("5000 codes, no collision", new Set(codes).size === 5000);

// A code is the only thing standing between a stranger and the graphic,
// so a short or predictable one is a real problem, not a style question.
const spread = new Set(codes.flatMap((c) => [...c]));
ok("draws on the whole alphabet", spread.size === 31, `${spread.size} distinct symbols seen`);

for (const bad of ["", "short", "waytoolongcode", "ABCDEFGHJK", "23456789a0", "2345 6789a", "234567890I"]) {
  ok(`rejects ${JSON.stringify(bad)}`, !isRoomCode(bad));
}
ok("channel name is namespaced", roomChannel("23456789ab") === "versus:23456789ab");

// ---- the message --------------------------------------------------------

const format = AUCTION_FORMATS["nfl-teams"] ?? Object.values(AUCTION_FORMATS)[0];
assert(format, "no formats registered - rosters missing from this checkout");

// Play a whole draft, checking every single state on the way through.
// A draft is a few dozen states and each one is a message that would be
// broadcast for real, so this is the actual payload set, not a sample.
let state = startAuction(format, ["Noah", "Ben"], "room-test");
let steps = 0;
let roundTripped = 0;
let accepted = 0;

while (state.phase !== "done" && steps < 500) {
  steps++;

  const wire = JSON.parse(JSON.stringify({ slug: format.slug, state }));
  assert.deepEqual(wire.state, state, `state did not survive JSON at step ${steps}`);
  roundTripped++;
  if (isBoardMessage(wire)) accepted++;

  if (state.phase === "ready" || state.phase === "spinning") {
    // Both are broadcast states in their own right - an overlay that
    // joins mid-spin has to be able to draw one - so they go over the
    // wire like every other.
    state = openLot(state, format);
    continue;
  }
  if (state.phase === "assigning" && state.won) {
    const item = currentItem(state, format);
    const slot = slotsItemCanFill(item, openSlots(state.players[state.won.by]))[0];
    state = reduce(state, { type: "assign", slotKey: slot }, format);
    continue;
  }
  const who = toAct(state, format);
  if (who === null) break;
  const range = bidRange(state, format, who);
  // Bid sometimes, pass sometimes - so the history, the rosters and both
  // budgets all end up non-trivial rather than every lot going for $0.
  // A player who cannot afford the floor's dollar can only pass.
  state = !range || steps % 3 === 0
    ? reduce(state, { type: "pass", by: who }, format)
    : reduce(state, { type: "bid", by: who, amount: Math.min(range.max, range.min + (steps % 4)) }, format);
}

ok("a full draft completed", state.phase === "done", `${steps} steps`);
ok("every state survived JSON unchanged", roundTripped === steps, `${roundTripped}/${steps}`);
ok("every state was accepted by the guard", accepted === steps, `${accepted}/${steps}`);
ok("the finished draft is a valid message too", isBoardMessage(JSON.parse(JSON.stringify({ slug: format.slug, state }))));
ok("the draft actually did something", state.history.length > 0, `${state.history.length} lots sold`);

// ---- what the guard must refuse ----------------------------------------

const good = JSON.parse(JSON.stringify({ slug: format.slug, state }));
const junk = [
  ["null", null],
  ["a string", "state"],
  ["an empty object", {}],
  ["no slug", { state: good.state }],
  ["no state", { slug: format.slug }],
  ["state is null", { slug: format.slug, state: null }],
  ["players missing", { slug: format.slug, state: { ...good.state, players: undefined } }],
  ["players empty", { slug: format.slug, state: { ...good.state, players: [] } }],
  ["a player with no budget", { slug: format.slug, state: { ...good.state, players: [{ name: "x", roster: {} }] } }],
  ["an unknown phase", { slug: format.slug, state: { ...good.state, phase: "paused" } }],
  ["index is a string", { slug: format.slug, state: { ...good.state, index: "3" } }],
  ["history missing", { slug: format.slug, state: { ...good.state, history: undefined } }],
];
for (const [name, value] of junk) ok(`drops ${name}`, !isBoardMessage(value));
ok("keeps a good message", isBoardMessage(good));

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
