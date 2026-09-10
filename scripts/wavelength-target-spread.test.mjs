// How many places the wedge can land, and how evenly it actually lands
// there.
//
// The complaint this exists to answer is "the same spot gets picked a
// lot", which is a claim about the DISTRIBUTION, not about the range - a
// generator with a thousand possible values can still be dull if it keeps
// returning the same fifty. So this plays whole games the way the board
// does and looks at where the wedges ended up, rather than calling the
// rng directly: the seeding path is where the last bug lived, and it is
// not reachable from pickTarget on its own.

import {
  startGame,
  reduce,
  BAND_2,
  BAND_3,
  BAND_4,
  DIAL_MAX,
  COOP_ROUNDS,
} from "../src/lib/wavelength/engine.ts";
import { cardsFor } from "../src/lib/wavelength/spectrums.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(50)} ${detail}`);
  if (!cond) failed++;
}

const cards = cardsFor("everything");
const EDGE = BAND_4;
const LO = EDGE;
const HI = DIAL_MAX - EDGE;
const STEP = 0.1;
const SLOTS = Math.round((HI - LO) / STEP) + 1;

// Play a real game to the end, collecting every target dealt.
function playGame(seed) {
  const targets = [];
  let s = startGame(cards, "everything", ["A", "B"], seed, "coop", COOP_ROUNDS);
  for (let round = 0; round < COOP_ROUNDS; round++) {
    targets.push(s.target);
    s = reduce(s, { type: "clue", text: "x" }, cards, seed);
    s = reduce(s, { type: "guess", value: 50 }, cards, seed);
    s = reduce(s, { type: "reveal" }, cards, seed);
    if (s.phase === "done") break;
    s = reduce(s, { type: "next" }, cards, seed);
  }
  return targets;
}

// The same way the board makes one: Math.random, base 36, eight chars.
const newSeed = () => Math.random().toString(36).slice(2, 10);

const GAMES = 4000;
const all = [];
const byRound = Array.from({ length: COOP_ROUNDS }, () => []);
for (let i = 0; i < GAMES; i++) {
  const t = playGame(newSeed());
  t.forEach((v, r) => {
    all.push(v);
    if (byRound[r]) byRound[r].push(v);
  });
}

console.log(`\n${all.length} targets from ${GAMES} games\n`);

// --- how many places are there at all ---------------------------------
ok("the wedge lands on a tenth", all.every((v) => Math.abs(v * 10 - Math.round(v * 10)) < 1e-9));
ok("never past the edge margin", all.every((v) => v >= LO - 1e-9 && v <= HI + 1e-9), `${Math.min(...all)} .. ${Math.max(...all)}`);
console.log(`   positions available: ${SLOTS}  (${LO} to ${HI} in steps of ${STEP})`);

const distinct = new Set(all).size;
console.log(`   positions actually seen: ${distinct} of ${SLOTS}\n`);

// --- is it flat --------------------------------------------------------
// Twenty buckets across the dial. Chi-square against a flat expectation:
// with 19 degrees of freedom, 30.14 is the 95th percentile and 43.82 the
// 99.9th. A generator this size should sit well under the first most of
// the time; over the second is a real signal, not noise.
const BUCKETS = 20;
const counts = new Array(BUCKETS).fill(0);
for (const v of all) {
  const i = Math.min(BUCKETS - 1, Math.floor(((v - LO) / (HI - LO)) * BUCKETS));
  counts[i]++;
}
const expect = all.length / BUCKETS;
const chi = counts.reduce((a, c) => a + (c - expect) ** 2 / expect, 0);
const worst = Math.max(...counts.map((c) => Math.abs(c - expect) / expect));

for (let i = 0; i < BUCKETS; i++) {
  const from = (LO + ((HI - LO) * i) / BUCKETS).toFixed(1).padStart(5);
  const bar = "#".repeat(Math.round((counts[i] / expect) * 24));
  console.log(`   ${from}  ${String(counts[i]).padStart(4)}  ${bar}`);
}
console.log();
ok("flat across the dial", chi < 43.82, `chi2=${chi.toFixed(1)} (19 df, 43.82 = p .001)`);
ok("no bucket is wildly off", worst < 0.15, `worst bucket ${(worst * 100).toFixed(1)}% from flat`);

// --- the failure people actually notice --------------------------------
// Not "is it uniform" but "does it repeat". Two targets within a band-4
// width of each other look like the same spot on screen, so that - not an
// exact match - is what "the same place again" means to somebody playing.
const NEAR = BAND_4;
let backToBack = 0;
let sameGameNear = 0;
for (let i = 0; i < GAMES; i++) {
  const t = all.slice(i * COOP_ROUNDS, (i + 1) * COOP_ROUNDS);
  for (let r = 1; r < t.length; r++) if (Math.abs(t[r] - t[r - 1]) <= NEAR) backToBack++;
  for (let a = 0; a < t.length; a++)
    for (let b = a + 1; b < t.length; b++) if (Math.abs(t[a] - t[b]) <= NEAR) sameGameNear++;
}
// Chance of two independent draws landing within +-2.4 of each other on a
// 95.2-wide range: about 2*4.8/95.2 minus the edge correction, ~4.8%.
const pairsPerGame = (COOP_ROUNDS * (COOP_ROUNDS - 1)) / 2;
const nearRate = sameGameNear / (GAMES * pairsPerGame);
const b2bRate = backToBack / (GAMES * (COOP_ROUNDS - 1));
console.log(`   two rounds landing within +-${NEAR}: ${(nearRate * 100).toFixed(1)}% of pairs`);
console.log(`   back-to-back within +-${NEAR}:       ${(b2bRate * 100).toFixed(1)}% of rounds\n`);
ok("repeats are at chance, not above", nearRate < 0.075, `${(nearRate * 100).toFixed(1)}% vs ~4.8% expected`);
ok("adjacent rounds are independent", b2bRate < 0.075, `${(b2bRate * 100).toFixed(1)}%`);

// --- the bug that was actually there once ------------------------------
// Round two used to be identical in every game, because the reseed did
// not include the game's own seed. Same round across different games must
// not collapse to a handful of values.
// Measured against the number of positions that EXIST, not the number of
// games - with 953 slots and 4000 games the ceiling is 953, and an
// earlier version of this check compared against the game count and so
// could never pass. Saturating most of the range is the real signal.
for (let r = 0; r < COOP_ROUNDS; r++) {
  const uniq = new Set(byRound[r]).size;
  ok(`round ${r + 1} differs between games`, uniq > SLOTS * 0.9, `${uniq} of ${SLOTS} positions in ${byRound[r].length} games`);
}

// --- why it FEELS repetitive even though it is not ---------------------
// "The same spot again" is a judgement made by eye, and an eye does not
// mean "within 2.4". At a glance a fifth of the dial reads as the same
// region, and the birthday problem does the rest: five rounds make ten
// pairs, so a near-miss somewhere in a game is the NORM, not a sign of a
// broken generator. Printed rather than asserted - this is the shape of
// randomness, not a defect to hold a line against.
console.log();
for (const width of [5, 10, 15, 20]) {
  let games = 0;
  for (let i = 0; i < GAMES; i++) {
    const t = all.slice(i * COOP_ROUNDS, (i + 1) * COOP_ROUNDS);
    const hit = t.some((a, x) => t.some((b, y) => y > x && Math.abs(a - b) <= width));
    if (hit) games++;
  }
  console.log(`   two of five rounds within +-${String(width).padStart(2)}: ${((games / GAMES) * 100).toFixed(0)}% of games`);
}

// --- and the bands it lands in ----------------------------------------
// Where the wedge sits changes how hard the round is: a target near an
// end has less dial either side of it. Worth knowing it is not crowding
// the middle.
const near = all.filter((v) => v < LO + BAND_2 * 2 || v > HI - BAND_2 * 2).length;
console.log(`\n   within a 2-band of either end: ${((near / all.length) * 100).toFixed(1)}%`);
console.log(`   (a flat dial would give ${(((BAND_2 * 4) / (HI - LO)) * 100).toFixed(1)}%)\n`);

console.log(failed === 0 ? "all target-spread checks pass" : `${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
