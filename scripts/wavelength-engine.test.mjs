// Wavelength's rules, and the one thing about them that is a security
// property rather than a rule.
//
// The engine is a pure reduce(state, action, cards, seed), for the same reason
// the auction's is: the rules are the part that has to be right, and they
// can be wrong in ways nobody notices until the last round of a live
// stream. So they are checked here rather than by playing.
//
// THE TARGET IS THE ONE SECRET IN THE GAME, and the rule about it is not
// "the graphic declines to draw it" - it is that the number is not in the
// MESSAGE. A number in the payload is a number anybody holding the browser
// source URL can read, and that URL lives in an OBS config and gets
// screen-shared.
//
// It is allowed out at exactly two moments, and the second one is a
// choice rather than a leak: the reveal, and while the psychic is holding
// the lid open - because opening the dial is now a beat the stream and the
// join link are meant to see. Both are checked here; so is the fact that
// it is nowhere near the wire at any other time.

import {
  startGame,
  reduce,
  bandFor,
  stealHits,
  redactFor,
  lidFor,
  waitingOn,
  other,
  BAND_2,
  BAND_3,
  BAND_4,
  COOP_ROUNDS,
  pairedRunLength,
  potMax,
  DIAL_MIN,
  DIAL_MAX,
  WIN_SCORE,
} from "../src/lib/wavelength/engine.ts";
import { SPECTRUMS, NFL_SPECTRUMS, DECKS, deck, cardsFor, customCards, CUSTOM_MAX, CUSTOM_LEN } from "../src/lib/wavelength/spectrums.ts";
import { waveChannel, isWaveMessage, isMoveMessage, MOVE, STATE } from "../src/lib/wavelength/room.ts";
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
// The custom deck ships empty on purpose - its cards are written by
// whoever is playing and live in their browser, not in this file.
ok(
  "both written decks have enough to play a game",
  DECKS.filter((d) => d.key !== "custom").every((d) => d.cards.length >= WIN_SCORE * 2),
);

// ---- the pairs somebody types --------------------------------------------

{
  const typed = [
    { left: "  Worst team  ", right: "Best team" },
    { left: "Only half", right: "   " },
    { left: "", right: "Also only half" },
    { left: "x".repeat(200), right: "y".repeat(200) },
  ];
  const made = customCards(typed);
  ok("a written pair becomes a card", made.length === 2, `${made.length} of ${typed.length} rows`);
  ok("with the whitespace off it", made[0].left === "Worst team" && made[0].right === "Best team");
  ok("half a pair is not a card", made.every((c) => c.left !== "" && c.right !== ""));
  ok("and a long one is cut to fit the dial", made[1].left.length === CUSTOM_LEN);
  ok("ids are unique", new Set(made.map((c) => c.id)).size === made.length);
  ok(
    "there is a ceiling on how many",
    customCards(Array.from({ length: CUSTOM_MAX + 20 }, (_, i) => ({ left: `l${i}`, right: `r${i}` }))).length === CUSTOM_MAX,
  );
  ok("nothing written is no cards, not a crash", customCards([]).length === 0);

  // One resolver, so no caller has to remember which kind of deck it holds.
  ok("cardsFor sends a built-in key to its own deck", cardsFor("football", typed) === NFL_SPECTRUMS);
  ok("and a custom key to what was written", cardsFor("custom", typed).length === 2);

  // A RUN THROUGH WHAT WAS WRITTEN, twice. Two prompts is four rounds,
  // three is six - because the point of the pairing is that each of the
  // two people is the psychic on every prompt.
  ok("two written pairs is a four round run", pairedRunLength(made) === 4, `${pairedRunLength(made)}`);
  ok("three would be six", pairedRunLength([1, 2, 3]) === 6);
  ok("and an empty list still deals something", pairedRunLength([]) === 2);

  const SHORT = "written-seed";
  let w = startGame(made, "custom", ["A", "B"], SHORT, "coop", pairedRunLength(made));
  ok("the run is as long as the list", w.runLength === 4);

  const dealtTo = [];
  let turns = 0;
  while (w.phase !== "done" && turns < 30) {
    turns++;
    dealtTo.push(`${w.card.id}/${w.psychic}`);
    w = reduce(w, { type: "guess", value: 50 }, made, SHORT);
    w = reduce(w, { type: "reveal" }, made, SHORT);
    if (w.phase === "done") break;
    w = reduce(w, { type: "next" }, made, SHORT);
  }
  ok("a written run is exactly its length", turns === 4, `${turns} rounds off ${made.length} cards`);
  ok("and it ends", w.phase === "done");

  // THE POINT OF THE PAIRING. Every card, once for each of them, and no
  // card twice with the same person holding it.
  ok("every pairing is played once", new Set(dealtTo).size === 4, dealtTo.join(" "));
  for (const card of made) {
    const psychics = dealtTo.filter((d) => d.startsWith(`${card.id}/`)).map((d) => d.split("/")[1]);
    ok(`both take a turn on ${card.left}`, psychics.length === 2 && psychics[0] !== psychics[1], psychics.join(","));
  }
  ok("the pot ceiling follows the run", potMax(w.runLength) === 16, `${potMax(w.runLength)}`);

  // The big decks are not played through twice - eighty-eight cards twice
  // is not an evening - so they keep the standard run and deal fresh.
  const big = startGame(CARDS, "everything", ["A", "B"], SHORT, "coop");
  ok("a built-in deck still runs five", big.runLength === COOP_ROUNDS);
  let b2 = big;
  const bigCards = [];
  for (let i = 0; i < 3; i++) {
    bigCards.push(b2.card.id);
    b2 = reduce(b2, { type: "guess", value: 50 }, CARDS, SHORT);
    b2 = reduce(b2, { type: "reveal" }, CARDS, SHORT);
    b2 = reduce(b2, { type: "next" }, CARDS, SHORT);
  }
  ok("and deals a fresh card every round", new Set(bigCards).size === 3, bigCards.join(","));
}
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

const SEED = "phases";
const fresh = startGame(CARDS, "everything", ["Us", "Them"], SEED);
ok("a new game starts on the clue", fresh.phase === "clue" && fresh.round === 1);
ok("a new game has no clue, no guess, no score", fresh.clue === "" && fresh.guess === null && fresh.teams.every((t) => t.score === 0));
// THE CLUE IS NOT A GATE. It used to be - the dial stayed dead until
// something had been typed - which is backwards for a game whose clue is
// SAID out loud. Typing it is for putting it on the graphic.
{
  const turnedWithoutAClue = reduce(fresh, { type: "guess", value: 50 }, CARDS, SEED);
  ok(
    "the dial turns with no clue typed at all",
    turnedWithoutAClue.phase === "guess" && turnedWithoutAClue.guess === 50 && turnedWithoutAClue.clue === "",
  );
  // ...and the whole round is reachable from there, in two presses.
  const straightToReveal = reduce(turnedWithoutAClue, { type: "reveal" }, CARDS, SEED);
  ok(
    "and the reveal is reachable without calling a side",
    straightToReveal.phase === "reveal" && straightToReveal.scored !== null && straightToReveal.scored.stolen === false,
  );
}
ok("nothing to reveal before there is a guess", reduce(fresh, { type: "reveal" }, CARDS, SEED) === fresh);
ok("no side to call before there is a guess", reduce(fresh, { type: "steal", side: "left" }, CARDS, SEED) === fresh);
ok("no next round before a reveal", reduce(fresh, { type: "next" }, CARDS, SEED) === fresh);
ok("the psychic is waited on first", waitingOn(fresh) === fresh.psychic);

const clued = reduce(fresh, { type: "clue", text: "Coffee" }, CARDS, SEED);
ok("a clue is taken while on the clue", clued.clue === "Coffee" && clued.phase === "clue");
ok("a clue can be backspaced to nothing", reduce(clued, { type: "clue", text: "" }, CARDS, SEED).clue === "");
const turned = reduce(clued, { type: "guess", value: 61.5 }, CARDS, SEED);
ok("the first turn of the dial opens the guess", turned.phase === "guess" && turned.guess === 61.5);
ok("the dial still moves after that", reduce(turned, { type: "guess", value: 20 }, CARDS, SEED).guess === 20);
ok("the dial cannot leave the board", reduce(turned, { type: "guess", value: 900 }, CARDS, SEED).guess === DIAL_MAX);
ok("nor the other way", reduce(turned, { type: "guess", value: -900 }, CARDS, SEED).guess === DIAL_MIN);
const called = reduce(turned, { type: "steal", side: "right" }, CARDS, SEED);
ok("a called side locks the dial", called.phase === "steal" && called.steal === "right");
ok("the dial is locked once a side is called", reduce(called, { type: "guess", value: 5 }, CARDS, SEED) === called);
// The turn changes hands inside the guess phase, which is the part the
// board draws its buttons from.
ok("the psychic's team is waited on until the dial moves", waitingOn(clued) === clued.psychic);
ok("the other team is waited on for the call", waitingOn(turned) === other(turned.psychic));
ok("nobody is waited on once the side is called", waitingOn(called) === null);
const shown = reduce(called, { type: "reveal" }, CARDS, SEED);
ok("the reveal scores", shown.phase === "reveal" && shown.scored !== null);
ok("nobody is waited on at the reveal", waitingOn(shown) === null);
const nextRound = reduce(shown, { type: "next" }, CARDS, SEED);
ok("the next round swaps the psychic", nextRound.psychic === other(shown.psychic));
ok("and clears the round", nextRound.clue === "" && nextRound.guess === null && nextRound.steal === null && nextRound.scored === null);
ok("and deals a card that has not been seen", !shown.seen.includes(nextRound.card.id));
ok("a clue is too long to break the graphic", reduce(fresh, { type: "clue", text: "x".repeat(500) }, CARDS, SEED).clue.length <= 60);

// ---- whole games --------------------------------------------------------
//
// Played rather than sampled: every state a real game passes through is a
// message that would be broadcast for real.

let games = 0;
let states = 0;
let leaks = 0;
let badScores = 0;
const allTargets = [];
let overWin = 0;
let repeats = 0;

// IS THE TARGET IN THIS MESSAGE, asked the only way that really answers
// it: redact the state twice, once with the real target and once with a
// different one, and compare the payloads byte for byte. If they are
// identical then the payload cannot carry any information about the
// target - not the number itself, not a copy of it nested somewhere, not
// anything derived from it.
//
// The first version of this hunted for the target's VALUE anywhere in the
// message. That was both weaker and wrong: weaker because a derived field
// would have sailed past it, and wrong because once the target was allowed
// near the edges of the dial it started colliding with ordinary small
// numbers - a team on 4 points and a target of 4.0 got reported as a leak.
function checkRedaction(state) {
  states++;
  const sent = redactFor(state);
  // Two moments the answer is allowed out: the reveal, and while the lid
  // is up - the psychic opening the dial is a beat everybody is meant to
  // see now, so for those seconds it really is on the wire. Both are
  // checked on their own below.
  if (state.phase === "reveal" || state.phase === "done") return sent;
  if (state.peek !== "shut") return sent;

  const decoy = redactFor({ ...state, target: (state.target + 37.3) % 100 });
  if (JSON.stringify(sent) !== JSON.stringify(decoy)) {
    leaks++;
    if (leaks === 1) console.log(`     the payload changes with the target:\n       ${JSON.stringify(sent)}`);
  }
  return sent;
}

for (let g = 0; g < 200; g++) {
  const cards = g % 2 === 0 ? CARDS : NFL_SPECTRUMS;
  // ITS OWN SEED, and it matters even in a test: the seed is what makes
  // two games deal differently, so sharing one across all 200 would hide
  // the very thing the spread check below is looking for.
  const gameSeed = `game-${g}`;
  let s = startGame(cards, g % 2 === 0 ? "everything" : "football", ["Us", "Them"], gameSeed);
  const dealt = [s.card.id];
  let rounds = 0;
  checkRedaction(s);

  while (s.phase !== "done" && rounds < 80) {
    rounds++;
    allTargets.push(s.target);

    const before = s.teams.map((t) => t.score);
    const psychic = s.psychic;

    s = reduce(s, { type: "clue", text: "clue" }, cards, gameSeed);
    checkRedaction(s);

    // A spread of guesses: dead on, close, miles off, and on the edges,
    // so every band and both sides of the call get played for real.
    const guess = [s.target, s.target + 2, s.target - 9, s.target + 30, DIAL_MIN, DIAL_MAX][rounds % 6];
    s = reduce(s, { type: "guess", value: guess }, cards, gameSeed);
    checkRedaction(s);

    const side = rounds % 2 === 0 ? "left" : "right";
    s = reduce(s, { type: "steal", side }, cards, gameSeed);
    checkRedaction(s);

    const target = s.target;
    const locked = s.guess;
    s = reduce(s, { type: "reveal" }, cards, gameSeed);
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

    s = reduce(s, { type: "next" }, cards, gameSeed);
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
// WHERE THE TARGET IS ALLOWED TO BE, which is very nearly anywhere.
//
// Think of it as the physical game: the wedge is printed on a full circle
// and only the top half shows, so it can sit mostly below the horizon with
// just its inner half on the board. The one thing that must always be
// reachable is the whole bullseye.
//
// It used to be pinned between 14 and 86 - the four could never land near
// either end - which after a few streams is a pattern people play against.
{
  const lo = Math.min(...allTargets), hi = Math.max(...allTargets);
  ok(
    "the whole bullseye is always on the board",
    allTargets.every((t) => t >= BAND_4 - 1e-9 && t <= DIAL_MAX - BAND_4 + 1e-9),
    `${lo} to ${hi}`,
  );
  ok("and the target reaches both ends of the dial", lo < 5 && hi > 95, `${lo} / ${hi}`);
  ok(
    "the wedge does hang off an edge sometimes",
    allTargets.filter((t) => t < BAND_2 || t > DIAL_MAX - BAND_2).length > allTargets.length / 10,
    `${allTargets.filter((t) => t < BAND_2 || t > DIAL_MAX - BAND_2).length} of ${allTargets.length}`,
  );

  // Uniform across the window it is allowed, in twenty equal buckets.
  // Measured against the LEGAL span rather than against 0..100, because
  // the two end tenths are only partly reachable and comparing them to a
  // flat tenth would understate them.
  const LO = BAND_4, HI = DIAL_MAX - BAND_4, N = 20, W = (HI - LO) / N;
  const buckets = Array.from({ length: N }, (_, i) =>
    allTargets.filter((t) => t >= LO + i * W && t < (i === N - 1 ? HI + 1e-9 : LO + (i + 1) * W)).length,
  );
  const expect = allTargets.length / N;
  const worst = Math.max(...buckets.map((b) => Math.abs(b - expect))) / expect;
  // Loose on purpose: this is a fairness check, not a chi-square. The
  // modulo-biased generator this replaced sat at 21%.
  ok("targets are spread evenly across the dial", worst < 0.3, `worst bucket ${(worst * 100).toFixed(1)}% off`);
}

// AND TWO GAMES ARE NOT THE SAME GAME. The per-round deal used to be
// seeded from `deck:round:scores` with nothing about WHICH game it was, so
// round two after a scoreless round one dealt an identical target every
// time - ten differently-seeded games all came back 18.5.
{
  const targets = [];
  for (let g = 0; g < 10; g++) {
    const seed = `distinct-${g}`;
    let s = startGame(CARDS, "everything", ["A", "B"], seed);
    s = reduce(s, { type: "clue", text: "x" }, CARDS, seed);
    s = reduce(s, { type: "guess", value: 0 }, CARDS, seed);
    s = reduce(s, { type: "steal", side: "left" }, CARDS, seed);
    s = reduce(s, { type: "reveal" }, CARDS, seed);
    targets.push(reduce(s, { type: "next" }, CARDS, seed).target);
  }
  ok("two games do not deal the same round two", new Set(targets).size >= 9, `${new Set(targets).size} distinct of 10`);
}

// The seed is the one thing that could hand the overlay the answer a round
// early - it plus the round and the scores, which are already on the wire,
// recomputes the target. It is not on the state at all, which is why.
ok(
  "the seed is not part of the state",
  !Object.prototype.hasOwnProperty.call(fresh, "seed") && !JSON.stringify(fresh).includes("phases"),
  "reduce() takes it as an argument instead",
);
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
    s = reduce(s, { type: "clue", text: "x" }, CARDS, SEED);
    s = reduce(s, { type: "guess", value: 40 }, CARDS, SEED);
    s = reduce(s, { type: "steal", side: "left" }, CARDS, SEED);
    s = reduce(s, { type: "reveal" }, CARDS, SEED);
    return redactFor(s).target === s.target && s.target !== null;
  })(),
  "a redaction that never lifts would draw an empty wedge",
);

// ---- the lid -------------------------------------------------------------
//
// Opening the dial is a move now, and it is the one move that changes what
// is allowed onto the wire. Three states rather than two, because the
// target has to outlive the shutter: the lid is only DRAWN open on "open",
// and the answer survives "closing" as well, or the wedge blinks out from
// under a lid still travelling.

{
  const LID = "lid";
  const shut = startGame(CARDS, "everything", ["A", "B"], LID);
  ok("a round starts with the lid shut", shut.peek === "shut");
  ok("and the answer is not on the wire", redactFor(shut).target === null);

  const open = reduce(shut, { type: "peek", at: "open" }, CARDS, LID);
  ok("holding it open is a move", open.peek === "open");
  ok("and the answer goes out with it", redactFor(open).target === open.target);

  const closing = reduce(open, { type: "peek", at: "closing" }, CARDS, LID);
  ok("the answer outlives the shutter", redactFor(closing).target === closing.target);

  const done = reduce(closing, { type: "peek", at: "shut" }, CARDS, LID);
  ok("and goes away once it has landed", redactFor(done).target === null);
  ok("a peek that changes nothing is not a move", reduce(done, { type: "peek", at: "shut" }, CARDS, LID) === done);

  // The lid cannot come back down over a revealed target, which would just
  // be a way to hide the result.
  let after = reduce(shut, { type: "guess", value: 50 }, CARDS, LID);
  after = reduce(after, { type: "reveal" }, CARDS, LID);
  ok("the lid is fixed once the round is revealed", reduce(after, { type: "peek", at: "open" }, CARDS, LID) === after);

  // And a new round shuts it again.
  const next = reduce(reduce(after, { type: "peek", at: "shut" }, CARDS, LID), { type: "next" }, CARDS, LID);
  ok("the next round starts shut", next.peek === "shut" && redactFor(next).target === null);
}

// ---- co-op --------------------------------------------------------------
//
// Two people on the same side, a fixed run, one pile. The mode changes
// three rules and nothing else, so those three are what is checked: no
// side to call, points go to the pot rather than a team, and the run ends
// when its rounds are used up rather than when somebody reaches a score.

{
  const SOLO = "coop-seed";
  const start = startGame(CARDS, "everything", ["Dallas", "Noah"], SOLO, "coop");
  ok("a co-op run starts empty", start.mode === "coop" && start.pot === 0 && start.runLength === COOP_ROUNDS);
  ok("nobody has a team score in co-op", start.teams.every((t) => t.score === 0));

  const turned = reduce(start, { type: "guess", value: start.target }, CARDS, SOLO);
  ok("there is no side to call in co-op", reduce(turned, { type: "steal", side: "left" }, CARDS, SOLO) === turned);
  const shownCoop = reduce(turned, { type: "reveal" }, CARDS, SOLO);
  ok("a dead-on guess banks four", shownCoop.pot === 4, `${shownCoop.pot}`);
  ok("and no team score moved", shownCoop.teams.every((t) => t.score === 0));
  ok("the psychic gets no separate credit", shownCoop.scored.stolen === false);

  // Play the whole run out, scoring it independently.
  let s2 = start;
  let expected = 0;
  let rounds = 0;
  const psychics = [];
  while (s2.phase !== "done" && rounds < 40) {
    rounds++;
    psychics.push(s2.psychic);
    const aim = [s2.target, s2.target + 3, s2.target - 20, s2.target + 6][rounds % 4];
    const clamped = Math.min(DIAL_MAX, Math.max(DIAL_MIN, aim));
    s2 = reduce(s2, { type: "guess", value: clamped }, CARDS, SOLO);
    expected += bandFor(s2.target, s2.guess);
    s2 = reduce(s2, { type: "reveal" }, CARDS, SOLO);
    if (s2.phase === "done") break;
    s2 = reduce(s2, { type: "next" }, CARDS, SOLO);
  }
  ok("a run is exactly its length", rounds === COOP_ROUNDS, `${rounds} rounds`);
  ok("and it ends", s2.phase === "done");
  ok("the pot is the sum of the bands", s2.pot === expected, `${s2.pot} vs ${expected}`);
  ok("the pot cannot beat what is on the table", s2.pot <= potMax(COOP_ROUNDS), `${s2.pot} of ${potMax(COOP_ROUNDS)}`);
  // Both people give clues, or one of them is just watching.
  ok("the psychic still swaps every round", psychics.every((p, i) => p === i % 2), psychics.join(""));
}

// ---- THE WHOLE HOP, minus the socket ------------------------------------
//
// THIS IS THE ONE THAT WAS MISSING, and a recording paid for it: a stream
// went out where the overlay never showed the psychic opening the dial.
// Every piece was tested - the rules said the lid was open, the redaction
// said the target was allowed out, the validator accepted the message -
// and none of that adds up to "the graphic drew it", because the step that
// decides what the graphic draws only existed inside a React component.
//
// So: take a real board state, redact it the way the board does, put it
// through JSON the way the wire does, check it the way the overlay does,
// and then ask THE GRAPHIC'S OWN FUNCTION what it would have drawn. Not a
// copy of the rule - the same lidFor() the overlay calls.

{
  const WIRE = "wire-hop";
  const start = startGame(CARDS, "everything", ["Us", "Them"], WIRE);

  // Down the wire exactly as the board sends it.
  const send = (state) => {
    const payload = JSON.parse(JSON.stringify({ deck: state.deck, state: redactFor(state) }));
    return isWaveMessage(payload) ? payload.state : null;
  };

  const shut = send(start);
  ok("a shut lid survives the wire", shut !== null);
  ok("and the overlay would draw it shut", lidFor(shut).open === false && lidFor(shut).wedge === false);
  ok("with no target to draw", shut.target === null);

  const open = reduce(start, { type: "peek", at: "open" }, CARDS, WIRE);
  const openOnWire = send(open);
  ok("an OPEN lid survives the wire", openOnWire !== null);
  ok("THE OVERLAY WOULD DRAW IT OPEN", lidFor(openOnWire).open === true, "this is the one that was broken");
  ok("and it has the wedge to draw", lidFor(openOnWire).wedge === true && openOnWire.target === open.target);

  const closing = send(reduce(open, { type: "peek", at: "closing" }, CARDS, WIRE));
  ok("a closing lid is drawn shut", lidFor(closing).open === false);
  ok("but still has its wedge, mid-shutter", lidFor(closing).wedge === true && closing.target !== null);

  // And the reveal, which is the other moment the wedge is allowed out.
  let played = reduce(start, { type: "guess", value: 40 }, CARDS, WIRE);
  played = reduce(played, { type: "reveal" }, CARDS, WIRE);
  const revealed = send(played);
  ok("the reveal reaches the overlay open", lidFor(revealed).open === true && lidFor(revealed).wedge === true);
  ok("with the answer on it", revealed.target === played.target);
}

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
  s = reduce(s, { type: "clue", text: "Coffee" }, CARDS, SEED);
  s = reduce(s, { type: "guess", value: 61.5 }, CARDS, SEED);
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
  ["a mode nobody has heard of", { deck: "x", state: { ...payload.state, mode: "solo" } }],
  ["no pot", { deck: "x", state: { ...payload.state, pot: undefined } }],
]) {
  ok(`drops ${name}`, !isWaveMessage(bad));
}

// ---- the one message that travels the other way -------------------------
//
// A guest turning the dial from their own phone is the only thing on this
// channel that goes towards the board, and it arrives from a machine
// nobody controls over a room anybody with the code can reach. So it is
// checked exactly as hard as everything else, and it carries exactly one
// number - the board reduces it like any other action and can refuse it.

ok("a move and a state are different events", MOVE !== STATE);
ok("a move is a number", isMoveMessage({ value: 61.5 }));
ok("zero is a number too", isMoveMessage({ value: 0 }));
for (const [name, bad] of [
  ["null", null],
  ["a bare number", 42],
  ["an empty object", {}],
  ["a string value", { value: "61.5" }],
  ["a null value", { value: null }],
  ["NaN", { value: NaN }],
  ["infinity", { value: Infinity }],
  ["a nested object", { value: { value: 5 } }],
]) {
  ok(`drops a move that is ${name}`, !isMoveMessage(bad));
}

// OUT OF RANGE IS NOT THE VALIDATOR'S PROBLEM, and deliberately so: the
// reducer already clamps every guess to the dial, so a hostile 9999 lands
// on the right-hand edge rather than being a second place that has to
// remember the rule.
{
  const SILLY = "clamp";
  let s3 = startGame(CARDS, "everything", ["A", "B"], SILLY);
  s3 = reduce(s3, { type: "guess", value: 99999 }, CARDS, SILLY);
  ok("a move way off the dial is clamped, not obeyed", s3.guess === DIAL_MAX, `${s3.guess}`);
  s3 = reduce(s3, { type: "guess", value: -99999 }, CARDS, SILLY);
  ok("and the same the other way", s3.guess === DIAL_MIN, `${s3.guess}`);
}

// And a move is refused outright wherever the dial is not live, which is
// what stops a guest nudging the needle after the side has been called.
{
  const LOCKED = "locked";
  let s4 = startGame(CARDS, "everything", ["A", "B"], LOCKED);
  s4 = reduce(s4, { type: "guess", value: 40 }, CARDS, LOCKED);
  const atCall = reduce(s4, { type: "steal", side: "left" }, CARDS, LOCKED);
  ok("a move after the call is refused", reduce(atCall, { type: "guess", value: 90 }, CARDS, LOCKED) === atCall);
  const atReveal = reduce(atCall, { type: "reveal" }, CARDS, LOCKED);
  ok("and so is one after the reveal", reduce(atReveal, { type: "guess", value: 90 }, CARDS, LOCKED) === atReveal);
}

// A WRITTEN DECK PLAYS IN THE ORDER IT WAS WRITTEN.
//
// Somebody types their categories in a sequence and means it. The pairing
// was right - each card twice, so both people get a turn as psychic on it
// - but the NEXT card was drawn at random, so the run was a shuffle of
// the list rather than the list. The pairing made that hard to see: it
// looked orderly and was not.
{
  const pairs = [
    { left: "Worst team", right: "Best team" },
    { left: "Overrated", right: "Underrated" },
    { left: "Cheap", right: "Expensive" },
  ];
  const written = customCards(pairs);
  const runLength = pairedRunLength(written);
  ok("three pairs is a six-round run", runLength === 6, `${runLength}`);

  // Ten seeds, because the old behaviour landed on the right order by
  // luck roughly one time in six and a single seed would have shipped it.
  const orders = new Set();
  const psychics = new Set();
  for (let g = 0; g < 10; g++) {
    const seed = `written-${g}`;
    let s = startGame(written, "custom", ["A", "B"], seed, "coop", runLength);
    const played = [];
    const held = [];
    for (let r = 0; r < runLength; r++) {
      played.push(written.findIndex((c) => c.id === s.card.id));
      held.push(s.psychic);
      s = reduce(s, { type: "clue", text: "x" }, written, seed);
      s = reduce(s, { type: "guess", value: 50 }, written, seed);
      s = reduce(s, { type: "reveal" }, written, seed);
      if (s.phase === "done") break;
      s = reduce(s, { type: "next" }, written, seed);
    }
    orders.add(played.join(","));
    psychics.add(held.join(","));
  }
  ok("every seed plays the same order", orders.size === 1, [...orders][0]);
  ok("and it is the order written", [...orders][0] === "0,0,1,1,2,2", [...orders][0]);
  // The reason a card comes up twice in the first place.
  ok("both people are psychic on each card", psychics.size === 1 && [...psychics][0] === "0,1,0,1,0,1", [...psychics][0]);
}

// The big decks must NOT do that. Eighty-eight cards and a five-round run
// is not a run through a list, and dealing those in file order would mean
// every game opened on the same card.
{
  const firsts = new Set();
  for (let g = 0; g < 60; g++) {
    const s = startGame(CARDS, "everything", ["A", "B"], `deck-${g}`, "coop", COOP_ROUNDS);
    firsts.add(s.card.id);
  }
  ok("a big deck still shuffles", firsts.size > 40, `${firsts.size} different opening cards in 60 games`);
}

console.log(failed === 0 ? "\nall good" : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
