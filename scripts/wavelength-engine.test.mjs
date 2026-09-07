// Wavelength's rules, and the one thing about them that is a security
// property rather than a rule.
//
// The engine is a pure reduce(state, action, cards), for the same reason
// the auction's is: the rules are the part that has to be right, and they
// can be wrong in ways nobody notices until the last round of a live
// stream. So they are checked here rather than by playing.
//
// THE TARGET IS THE ONE SECRET IN THE GAME. Everything else on the wire is
// already on screen. If the target reaches the overlay before the reveal
// then anybody holding the browser source URL - which lives in an OBS
// config and gets screen-shared - can read the answer out of the payload,
// and the game is over as a game. That is what the redaction block below
// exists for, and it is deliberately the longest one in this file.

import {
  startGame,
  reduce,
  bandFor,
  stealHits,
  redactFor,
  waitingOn,
  other,
  BAND_2,
  BAND_3,
  BAND_4,
  DIAL_MIN,
  DIAL_MAX,
  WIN_SCORE,
} from "../src/lib/wavelength/engine.ts";
import { SPECTRUMS, NFL_SPECTRUMS, DECKS, deck } from "../src/lib/wavelength/spectrums.ts";
import { waveChannel, isWaveMessage } from "../src/lib/wavelength/room.ts";
import { roomChannel } from "../src/lib/auction/room.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(56)} ${detail}`);
  if (!cond) failed++;
}

const CARDS = SPECTRUMS;

// ---- the deck -----------------------------------------------------------

ok("every card has two ends", CARDS.every((c) => c.left.trim() !== "" && c.right.trim() !== ""));
ok("no card has the same word twice", CARDS.every((c) => c.left.toLowerCase() !== c.right.toLowerCase()));
ok("ids are unique", new Set(CARDS.map((c) => c.id)).size === CARDS.length, `${CARDS.length} cards`);
ok(
  "no duplicate pairs",
  new Set(CARDS.map((c) => `${c.left.toLowerCase()}|${c.right.toLowerCase()}`)).size === CARDS.length,
);
ok("the football deck is only football", NFL_SPECTRUMS.every((c) => c.nfl === true), `${NFL_SPECTRUMS.length} cards`);
ok("both decks have enough to play a game", DECKS.every((d) => d.cards.length >= WIN_SCORE * 2));
ok("an unknown deck key falls back rather than throwing", deck("nonsense").length > 0);

// ---- scoring ------------------------------------------------------------

// The bands are what the whole graphic is drawn from, so the edges of each
// one are checked from both sides rather than sampled in the middle.
ok("dead centre is 4", bandFor(50, 50) === 4);
ok("the edge of the bullseye is still 4", bandFor(50, 50 + BAND_4) === 4);
ok("a hair outside the bullseye is 3", bandFor(50, 50 + BAND_4 + 0.1) === 3);
ok("the edge of the three band is 3", bandFor(50, 50 - BAND_3) === 3);
ok("a hair outside that is 2", bandFor(50, 50 - BAND_3 - 0.1) === 2);
ok("the edge of the two band is 2", bandFor(50, 50 + BAND_2) === 2);
ok("a hair outside the wedge is nothing", bandFor(50, 50 + BAND_2 + 0.1) === 0);
ok("the far end of the dial is nothing", bandFor(50, DIAL_MAX) === 0 && bandFor(50, DIAL_MIN) === 0);
ok("the wedge is symmetrical", [0.5, 2.4, 4, 7.2, 12, 20].every((d) => bandFor(50, 50 - d) === bandFor(50, 50 + d)));

// FIVE EQUAL SLOTS, 2 3 4 3 2, the way the board is printed. Checked as
// widths rather than as the three constants, because that is the thing
// that is actually true about it and the thing that was wrong before: the
// bullseye used to be 7 units against 4 and 4.5 for its neighbours.
{
  const widths = [BAND_2 - BAND_3, BAND_3 - BAND_4, BAND_4 * 2, BAND_3 - BAND_4, BAND_2 - BAND_3];
  const even = widths.every((w) => Math.abs(w - widths[0]) < 1e-9);
  ok("all five scoring slots are the same width", even, widths.map((w) => w.toFixed(2)).join(" / "));
}

// The float dust that made a guess landing exactly on a line score the
// band below the one it earned.
ok(
  "a guess exactly on a boundary takes the better band",
  bandFor(50, 50 - BAND_3) === 3 && bandFor(50, 50 + BAND_3) === 3 && bandFor(50, 50 - BAND_4) === 4,
  "50 - 7.2 is 7.200000000000003, not 7.2",
);

// ---- the catch-up call --------------------------------------------------

ok("left is right when the target is left", stealHits(30, 40, "left") === true);
ok("left is wrong when the target is right", stealHits(60, 40, "left") === false);
ok("right is right when the target is right", stealHits(60, 40, "right") === true);
// A guess that lands exactly on the target has no side to be on, and
// handing the other team a point on a coin flip would punish the best
// possible round in the game.
ok("a perfect guess cannot be stolen from", stealHits(40, 40, "left") === false && stealHits(40, 40, "right") === false);

// ---- the phase machine --------------------------------------------------

const fresh = startGame(CARDS, "everything", ["Us", "Them"], "phases");
ok("a new game starts on the clue", fresh.phase === "clue" && fresh.round === 1);
ok("a new game has no clue, no guess, no score", fresh.clue === "" && fresh.guess === null && fresh.teams.every((t) => t.score === 0));
ok("the dial is dead before there is a clue", reduce(fresh, { type: "guess", value: 50 }, CARDS) === fresh);
ok("nothing to reveal before there is a guess", reduce(fresh, { type: "reveal" }, CARDS) === fresh);
ok("no side to call before there is a guess", reduce(fresh, { type: "steal", side: "left" }, CARDS) === fresh);
ok("no next round before a reveal", reduce(fresh, { type: "next" }, CARDS) === fresh);
ok("the psychic is waited on first", waitingOn(fresh) === fresh.psychic);

const clued = reduce(fresh, { type: "clue", text: "Coffee" }, CARDS);
ok("a clue is taken while on the clue", clued.clue === "Coffee" && clued.phase === "clue");
ok("a clue can be backspaced to nothing", reduce(clued, { type: "clue", text: "" }, CARDS).clue === "");
const turned = reduce(clued, { type: "guess", value: 61.5 }, CARDS);
ok("the first turn of the dial opens the guess", turned.phase === "guess" && turned.guess === 61.5);
ok("the dial still moves after that", reduce(turned, { type: "guess", value: 20 }, CARDS).guess === 20);
ok("the dial cannot leave the board", reduce(turned, { type: "guess", value: 900 }, CARDS).guess === DIAL_MAX);
ok("nor the other way", reduce(turned, { type: "guess", value: -900 }, CARDS).guess === DIAL_MIN);
const called = reduce(turned, { type: "steal", side: "right" }, CARDS);
ok("a called side locks the dial", called.phase === "steal" && called.steal === "right");
ok("the dial is locked once a side is called", reduce(called, { type: "guess", value: 5 }, CARDS) === called);
// The turn changes hands inside the guess phase, which is the part the
// board draws its buttons from.
ok("the psychic's team is waited on until the dial moves", waitingOn(clued) === clued.psychic);
ok("the other team is waited on for the call", waitingOn(turned) === other(turned.psychic));
ok("nobody is waited on once the side is called", waitingOn(called) === null);
const shown = reduce(called, { type: "reveal" }, CARDS);
ok("the reveal scores", shown.phase === "reveal" && shown.scored !== null);
ok("nobody is waited on at the reveal", waitingOn(shown) === null);
const nextRound = reduce(shown, { type: "next" }, CARDS);
ok("the next round swaps the psychic", nextRound.psychic === other(shown.psychic));
ok("and clears the round", nextRound.clue === "" && nextRound.guess === null && nextRound.steal === null && nextRound.scored === null);
ok("and deals a card that has not been seen", !shown.seen.includes(nextRound.card.id));
ok("a clue is too long to break the graphic", reduce(fresh, { type: "clue", text: "x".repeat(500) }, CARDS).clue.length <= 60);

// ---- whole games --------------------------------------------------------
//
// Played rather than sampled: every state a real game passes through is a
// message that would be broadcast for real.

let games = 0;
let states = 0;
let leaks = 0;
let badScores = 0;
let edgeTargets = 0;
let overWin = 0;
let repeats = 0;

// Every path in a JSON-safe object whose value equals `value`. The point
// is that checking the `target` field is not enough: what crosses the wire
// is the whole object, so a copy of the number anywhere in it - a nested
// card, a scored block, a field added next year - is just as readable to
// anybody who opens the browser source.
//
// Paths rather than a substring search of the JSON, because a guess that
// lands exactly on the target is a legal and fairly common thing for the
// message to contain, and grepping the bytes cannot tell the two apart.
function pathsHolding(value, node, path = "state", found = []) {
  if (node === value) found.push(path);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) pathsHolding(value, v, `${path}.${k}`, found);
  }
  return found;
}

function checkRedaction(state) {
  states++;
  const sent = redactFor(state);
  if (state.phase === "reveal" || state.phase === "done") return sent;

  // The board still knows the answer; the message must not.
  const carried = pathsHolding(state.target, JSON.parse(JSON.stringify(sent))).filter(
    // The dial's position is the team's own guess. It is on screen
    // already, and it being right is the good outcome, not a leak.
    (p) => p !== "state.guess",
  );
  if (carried.length > 0) {
    leaks++;
    if (leaks === 1) console.log(`     leaked at ${carried.join(", ")}`);
  }
  return sent;
}

for (let g = 0; g < 200; g++) {
  const cards = g % 2 === 0 ? CARDS : NFL_SPECTRUMS;
  let s = startGame(cards, g % 2 === 0 ? "everything" : "football", ["Us", "Them"], `game-${g}`);
  const dealt = [s.card.id];
  let rounds = 0;
  checkRedaction(s);

  while (s.phase !== "done" && rounds < 80) {
    rounds++;
    if (s.target < BAND_2 || s.target > DIAL_MAX - BAND_2) edgeTargets++;

    const before = s.teams.map((t) => t.score);
    const psychic = s.psychic;

    s = reduce(s, { type: "clue", text: "clue" }, cards);
    checkRedaction(s);

    // A spread of guesses: dead on, close, miles off, and on the edges,
    // so every band and both sides of the call get played for real.
    const guess = [s.target, s.target + 2, s.target - 9, s.target + 30, DIAL_MIN, DIAL_MAX][rounds % 6];
    s = reduce(s, { type: "guess", value: guess }, cards);
    checkRedaction(s);

    const side = rounds % 2 === 0 ? "left" : "right";
    s = reduce(s, { type: "steal", side }, cards);
    checkRedaction(s);

    const target = s.target;
    const locked = s.guess;
    s = reduce(s, { type: "reveal" }, cards);
    checkRedaction(s);

    // Scored against the rules computed independently, not against the
    // engine's own answer.
    const band = bandFor(target, locked);
    const stolen = stealHits(target, locked, side);
    const gained = s.teams.map((t, i) => t.score - before[i]);
    if (gained[psychic] !== band) badScores++;
    if (gained[other(psychic)] !== (stolen ? 1 : 0)) badScores++;
    if (s.scored.band !== band || s.scored.stolen !== stolen) badScores++;

    if (s.phase === "done") {
      if (!s.teams.some((t) => t.score >= WIN_SCORE)) overWin++;
      break;
    }
    if (s.teams.some((t) => t.score >= WIN_SCORE)) overWin++;

    s = reduce(s, { type: "next" }, cards);
    checkRedaction(s);
    // Cards do not come round again while there are unplayed ones left.
    if (dealt.length < cards.length && dealt.includes(s.card.id)) repeats++;
    dealt.push(s.card.id);
  }
  if (s.phase === "done") games++;
}

ok("200 games all finish", games === 200, `${games} reached a winner`);
ok("every score matches the rules", badScores === 0, `${states} states scored`);
ok("nobody wins without reaching the score", overWin === 0);
ok("a target is never close enough to the edge to be unwinnable", edgeTargets === 0);
ok("the deck does not repeat while it has cards left", repeats === 0);

// THE ONE THAT MATTERS.
ok(
  "the target is never on the wire before the reveal",
  leaks === 0,
  `${states} broadcasts checked, ${leaks} leaked`,
);
ok(
  "and it IS on the wire at the reveal",
  (() => {
    let s = startGame(CARDS, "everything", ["Us", "Them"], "reveal-check");
    s = reduce(s, { type: "clue", text: "x" }, CARDS);
    s = reduce(s, { type: "guess", value: 40 }, CARDS);
    s = reduce(s, { type: "steal", side: "left" }, CARDS);
    s = reduce(s, { type: "reveal" }, CARDS);
    return redactFor(s).target === s.target && s.target !== null;
  })(),
  "a redaction that never lifts would draw an empty wedge",
);

// ---- the wire -----------------------------------------------------------

ok("the channel is namespaced to the game", waveChannel("23456789ab") === "wavelength:23456789ab");
ok(
  "a code reused across games is two different rooms",
  waveChannel("23456789ab") !== roomChannel("23456789ab"),
  "otherwise a wavelength board broadcasts into a versus overlay",
);

// Round-tripped through JSON, because that is what actually crosses.
const live = (() => {
  let s = startGame(CARDS, "everything", ["Us", "Them"], "wire");
  s = reduce(s, { type: "clue", text: "Coffee" }, CARDS);
  s = reduce(s, { type: "guess", value: 61.5 }, CARDS);
  return s;
})();
const payload = JSON.parse(JSON.stringify({ deck: "everything", state: redactFor(live) }));
ok("a real message survives JSON and is accepted", isWaveMessage(payload));
ok("a redacted target is legal", payload.state.target === null && isWaveMessage(payload));
ok("nothing is lost crossing the wire", JSON.stringify(payload.state) === JSON.stringify(redactFor(live)));

for (const [name, bad] of [
  ["null", null],
  ["a string", "state"],
  ["an empty object", {}],
  ["no deck", { state: payload.state }],
  ["no state", { deck: "everything" }],
  ["one team", { deck: "x", state: { ...payload.state, teams: [payload.state.teams[0]] } }],
  ["a team with no score", { deck: "x", state: { ...payload.state, teams: [{ name: "a" }, { name: "b" }] } }],
  ["a phase nobody has heard of", { deck: "x", state: { ...payload.state, phase: "shopping" } }],
  ["a target that is a string", { deck: "x", state: { ...payload.state, target: "40" } }],
  ["no card", { deck: "x", state: { ...payload.state, card: null } }],
  ["half a card", { deck: "x", state: { ...payload.state, card: { left: "Cold" } } }],
  ["a clue that is a number", { deck: "x", state: { ...payload.state, clue: 7 } }],
]) {
  ok(`drops ${name}`, !isWaveMessage(bad));
}

console.log(failed === 0 ? "\nall good" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
