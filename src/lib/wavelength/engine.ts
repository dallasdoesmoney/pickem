import type { Spectrum } from "./spectrums";

// WAVELENGTH, as a pure function.
//
// Same arrangement as the auction: the rules are a reducer over an
// immutable state, so the board that plays it and the overlay that draws
// it are two readers of one value and cannot drift. Nothing in here
// touches React, the network or the clock.
//
// A ROUND, end to end:
//
//   1. A card comes up - two opposite ideas, and a TARGET hidden
//      somewhere between them. Only the psychic sees the target.
//   2. The psychic says a clue out loud and types it in, so the graphic
//      can carry it. One word, ideally.
//   3. Their team turns the dial to where they think the target is.
//   4. The other team says LEFT or RIGHT: which side of that needle the
//      target really is. This is the catch-up rule and it is what stops
//      one good psychic running away with the game.
//   5. Reveal, score, swap psychics.
//
// THE TARGET IS THE ONE SECRET IN THE GAME, which makes it the one thing
// the engine has to be careful with - see redactFor() at the bottom, and
// the note above it.

export type TeamIndex = 0 | 1;

// The dial runs 0 to 100, left to right. Not degrees: the graphic draws
// it as a half-circle but the RULES do not care, and a number line is
// easier to reason about and to test than an angle.
export const DIAL_MIN = 0;
export const DIAL_MAX = 100;

// HOW WIDE THE SCORING BANDS ARE, measured as distance from the centre of
// the target. Four points for the bullseye, then three, then two, and
// nothing outside.
//
// FIVE EQUAL SLOTS - 2 3 4 3 2 - the way the board is printed. They were
// not: the bullseye was 7 units wide against 4 and 4.5 for the rings
// either side, so the hardest thing to hit was the biggest target on the
// dial and it looked wrong next to its neighbours.
//
// The whole wedge is still 24 units of 100, a shade under a quarter of the
// dial, so each slot is 4.8. Constants rather than literals in the scoring
// function because they are the first thing anybody will want to tune
// after playing it twice.
const SLOT_WIDTH = 4.8;
export const BAND_4 = SLOT_WIDTH / 2;
export const BAND_3 = BAND_4 + SLOT_WIDTH;
export const BAND_2 = BAND_3 + SLOT_WIDTH;

// How far from either edge the target may be. Without this the target
// sits at 99 often enough to matter, and a target on the edge is a bad
// round - half the wedge is off the board, so the best possible clue
// still scores two.
const EDGE_MARGIN = BAND_2 + 2;

export const WIN_SCORE = 10;

export type Phase =
  // The card is up and the psychic is looking at the target. Nobody else
  // is allowed to see anything yet.
  | "clue"
  // The clue is in. The team turns the dial.
  | "guess"
  // The dial is locked. The other team calls which side.
  | "steal"
  // Everything is shown and scored.
  | "reveal"
  | "done";

export type WavelengthState = {
  deck: string;
  teams: { name: string; score: number }[];
  // Whose turn it is to be psychic. The other team is the one calling
  // left or right.
  psychic: TeamIndex;
  round: number;
  phase: Phase;

  // The card. Kept on the state rather than looked up, for the same
  // reason the auction resolves labels at assignment time: the overlay
  // draws from state alone and must not need a second lookup to fill in
  // what it is showing.
  card: Spectrum;
  // Cards already used, so a session does not repeat one.
  seen: string[];

  // THE SECRET. Null on any copy that has been redacted for the overlay
  // before the reveal - which is most of them.
  target: number | null;

  clue: string;
  // Where the team left the dial. Null until they lock it in.
  guess: number | null;
  // Which side of the guess the other team says the target is on.
  steal: "left" | "right" | null;

  // Filled at the reveal, so the graphic can draw the result without
  // recomputing the rules.
  scored: { band: number; stolen: boolean } | null;
};

// A tiny deterministic generator, same idea as the auction's shuffle: a
// draft played from a given seed deals the same cards, which is what
// makes a bug reproducible instead of a story about last Tuesday.
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 100000) / 100000;
  };
}

function pickTarget(random: () => number): number {
  return Math.round((EDGE_MARGIN + random() * (DIAL_MAX - 2 * EDGE_MARGIN)) * 10) / 10;
}

function pickCard(cards: Spectrum[], seen: string[], random: () => number): Spectrum {
  // Once every card has been used the deck starts again rather than
  // running out. A session that outlasts the deck is a good problem.
  const fresh = cards.filter((c) => !seen.includes(c.id));
  const pool = fresh.length > 0 ? fresh : cards;
  return pool[Math.floor(random() * pool.length) % pool.length];
}

export function startGame(
  cards: Spectrum[],
  deckKey: string,
  names: string[],
  seed: string,
): WavelengthState {
  const random = rng(seed);
  const card = pickCard(cards, [], random);
  return {
    deck: deckKey,
    teams: names.map((name) => ({ name, score: 0 })),
    psychic: 0,
    round: 1,
    phase: "clue",
    card,
    seen: [card.id],
    target: pickTarget(random),
    clue: "",
    guess: null,
    steal: null,
    scored: null,
  };
}

// WHAT A GUESS IS WORTH. Distance from the centre of the target, in
// bands. Nothing outside the widest band scores.
// A hair of tolerance on each edge, and it is not pedantry: the dial and
// the target are both quantised to a tenth, so landing exactly on a
// boundary is a thing that happens in real play - and 50 - 7.2 comes back
// as 7.200000000000003, which put a guess sitting precisely on the line
// into the band BELOW the one it had earned.
const EDGE = 1e-9;

export function bandFor(target: number, guess: number): number {
  const d = Math.abs(guess - target);
  if (d <= BAND_4 + EDGE) return 4;
  if (d <= BAND_3 + EDGE) return 3;
  if (d <= BAND_2 + EDGE) return 2;
  return 0;
}

// Did the other team call the side correctly? A guess that lands exactly
// on the target is not stealable - there is no side to be on, and giving
// it to them on a coin flip would punish the best possible round.
export function stealHits(target: number, guess: number, side: "left" | "right"): boolean {
  if (target === guess) return false;
  return side === "left" ? target < guess : target > guess;
}

export type WavelengthAction =
  | { type: "clue"; text: string }
  | { type: "guess"; value: number }
  | { type: "steal"; side: "left" | "right" }
  | { type: "reveal" }
  | { type: "next" };

const CLUE_MAX = 60;

export function reduce(
  state: WavelengthState,
  action: WavelengthAction,
  cards: Spectrum[],
): WavelengthState {
  if (action.type === "clue") {
    if (state.phase !== "clue") return state;
    // Typed rather than submitted, so the graphic fills in as the psychic
    // types and the room can read it before they have finished. A blank
    // one is allowed HERE - backspacing to nothing is a normal thing to
    // do - and refused where it matters, in "guess" below: the dial does
    // not become live until there is a clue on the board.
    return { ...state, clue: action.text.slice(0, CLUE_MAX) };
  }

  if (action.type === "guess") {
    if (state.phase !== "clue" && state.phase !== "guess") return state;
    const value = Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(action.value * 10) / 10));
    // Moving the dial during "clue" is how the team plays: the phase
    // advances the moment the psychic has typed something, so the dial is
    // live and the graphic shows it moving.
    if (state.phase === "clue") {
      if (state.clue.trim() === "") return state;
      return { ...state, phase: "guess", guess: value };
    }
    return { ...state, guess: value };
  }

  if (action.type === "steal") {
    // The dial has to be somewhere before there are sides to choose
    // between.
    if (state.phase !== "guess" || state.guess === null) return state;
    return { ...state, phase: "steal", steal: action.side };
  }

  if (action.type === "reveal") {
    if (state.phase !== "steal" || state.guess === null || state.target === null) return state;
    const band = bandFor(state.target, state.guess);
    const stolen = state.steal !== null && stealHits(state.target, state.guess, state.steal);
    const teams = state.teams.map((t, i) => ({
      ...t,
      score: t.score + (i === state.psychic ? band : stolen ? 1 : 0),
    }));
    const over = teams.some((t) => t.score >= WIN_SCORE);
    return { ...state, phase: over ? "done" : "reveal", teams, scored: { band, stolen } };
  }

  if (action.type === "next") {
    if (state.phase !== "reveal") return state;
    // Seeded from the round rather than from the original seed, so the
    // next card does not depend on how long the last one took.
    const random = rng(`${state.deck}:${state.round}:${state.teams.map((t) => t.score).join("-")}`);
    const card = pickCard(cards, state.seen, random);
    return {
      ...state,
      round: state.round + 1,
      psychic: (state.psychic === 0 ? 1 : 0) as TeamIndex,
      phase: "clue",
      card,
      seen: [...state.seen, card.id].slice(-cards.length),
      target: pickTarget(random),
      clue: "",
      guess: null,
      steal: null,
      scored: null,
    };
  }

  return state;
}

// THE ONE SECRET, AND THE ONE PLACE IT IS KEPT.
//
// The board holds the target from the moment the card comes up. The
// overlay must not have it until the reveal - and "must not have it"
// means it is not in the message, not that the graphic declines to draw
// it. A number that is in the payload is a number anybody who opens the
// browser source can read, and the browser source is a URL that lives in
// an OBS config and gets screen-shared.
//
// So the board redacts before it sends, and the overlay is simply never
// given the answer until there is no longer an answer to protect.
export function redactFor(state: WavelengthState): WavelengthState {
  if (state.phase === "reveal" || state.phase === "done") return state;
  return { ...state, target: null };
}

// Whose move the game is waiting for, as something the board can print.
//
// The turn changes hands INSIDE the guess phase, which is the part that is
// easy to get wrong: the psychic's team turns the dial, and the moment it
// is somewhere the other team has to call which side of it the target is
// on. So the phase alone does not answer this - whether there is a guess
// yet is half of it.
//
// Null once the side has been called: from there it is the host pressing
// reveal, and a reveal is not a team's move.
export function waitingOn(state: WavelengthState): TeamIndex | null {
  if (state.phase === "clue") return state.psychic;
  if (state.phase === "guess") return state.guess === null ? state.psychic : other(state.psychic);
  return null;
}

export function other(team: TeamIndex): TeamIndex {
  return team === 0 ? 1 : 0;
}
