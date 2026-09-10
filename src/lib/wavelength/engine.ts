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

// HOW FAR FROM EITHER EDGE THE TARGET MAY BE, and the answer is barely at
// all. Think of it the way the physical game works: the scoring wedge is
// printed on a full circle and only the top half of that circle shows, so
// the wedge can sit anywhere - including mostly below the horizon with
// just its inner half on the board.
//
// The one thing that must always be on the board is the whole bullseye,
// because a 4 you cannot reach is not a round. At exactly this margin the
// four is fully on and one complete side of the wedge with it - the full
// four and one half of the points - which is the least the board is ever
// allowed to show.
//
// It used to be BAND_2 + 2, which pinned every target between 14 and 86:
// the four could never land near either end, and after a few streams that
// is a pattern people play against.
const EDGE_MARGIN = BAND_4;

export const WIN_SCORE = 10;

// TWO WAYS TO PLAY, and the second one is the common one: most nights it
// is two people at a desk, not two teams. In CO-OP they are on the same
// side - one psychic, one guesser, swapping every round - and the only
// question is how many points the pair can pile up over a fixed run.
//
// A fixed run rather than "first to ten", because a shared score racing to
// a target has no tension: you always get there eventually. A number at
// the end is the thing worth beating.
export type Mode = "teams" | "coop";

// Five rounds off one of the big decks, which is a length rather than a
// rule - there are eighty-eight cards, so where it stops is arbitrary and
// five is a good clip.
export const COOP_ROUNDS = 5;

// A WRITTEN DECK IS DIFFERENT. If somebody sat down and typed three
// prompts, the run is those three prompts - twice, so each of them gets a
// turn being the psychic on each one. Three categories, six rounds.
//
// Which also means the deal is PAIRED: the same card comes up twice in a
// row, with a fresh target the second time and the other person holding
// it. Alternating instead would put the same psychic on the same card
// both times, since the psychic swaps every round anyway.
export function pairedRunLength(cards: Spectrum[]): number {
  return Math.max(1, cards.length) * 2;
}

// Four points a round is the most that is on the table.
export function potMax(runLength: number): number {
  return runLength * 4;
}

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
  mode: Mode;
  // Always the two PEOPLE, in both modes. In co-op they still take turns
  // being the psychic, so both names and both colours are still needed -
  // it is only the scoring that is shared.
  teams: { name: string; score: number }[];
  // Co-op only: the shared pile, and how long the run is. Zero and zero in
  // a team game, where the score lives on the teams themselves.
  pot: number;
  runLength: number;
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

  // IS THE LID UP, and why it is three states rather than a boolean.
  //
  // The psychic opening the dial is now something EVERYBODY sees - the
  // stream and whoever is on the join link - so it cannot be a flag one
  // screen keeps to itself. It is part of the game, it travels with the
  // game, and every screen draws the same lid.
  //
  // "closing" is the middle state and it is not decoration: the target has
  // to stay in the message until the shutter has finished travelling, or
  // the wedge blinks out from under a lid that is still moving. The lid is
  // only drawn open on "open"; the target survives both.
  peek: "open" | "closing" | "shut";

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
// game played from a given seed deals the same cards, which is what makes
// a bug reproducible instead of a story about last Tuesday.
function rng(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const next = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    // Divided by the full 2^32 rather than taken modulo 100000: the
    // modulo left a visible bias - two buckets in twenty sitting three
    // standard deviations high over five thousand targets - and it threw
    // away most of the resolution while doing it.
    return (h >>> 0) / 4294967296;
  };
  // Thrown away, because the strings handed to this differ by a character
  // or two - one round number, one score - and xorshift takes a few turns
  // to forget how close two starting states were. Without it, adjacent
  // rounds draw suspiciously similar numbers.
  for (let i = 0; i < 12; i++) next();
  return next;
}

// HOW FAR THE WEDGE MUST MOVE BETWEEN ROUNDS.
//
// The dial is genuinely uniform - measured, 953 positions, flat across
// twenty buckets, adjacent rounds no more alike than distant ones. The
// trouble is that uniform CLUMPS, and a clump back-to-back is dull to
// watch: nothing is broken, it is just not good television.
//
// So this is a deliberate departure from random, and only between
// CONSECUTIVE rounds - two similar spots four rounds apart is nobody's
// complaint, and constraining those would cost far more randomness than
// it bought.
//
// BAND_3, which is the outer edge of the 3-zone. The point is to look
// like a different place, NOT to punish anyone for remembering the last
// one: aim at exactly where the wedge sat last round and you still score
// 3. That is the brief - visibly moved, still scoreable.
//
// It is worth writing down what the wider alternative cost, because the
// obvious instinct is that further is better. BAND_2 (12) puts the new
// bullseye outside the old scoring zone entirely, so the old spot scores
// zero - and it doubled the price below, 11% out in the end buckets
// against 5.7%. Twice the distortion to make the game meaner. BAND_3
// moves 13.6 degrees of arc, which is plainly a different place on
// screen, and leaves the dial within noise of flat.
//
// WHAT IT COSTS. Holding rounds apart tilts the dial toward its ends at
// all - an edge position is legal after more predecessors than a central
// one is, and no minimum-separation rule can avoid that. At this distance
// it is 20.3% of targets in the outer tenth against 20.0% for a flat
// dial, which is nothing. It also does not compound: round two reaches
// that and rounds three onward stay there.
//
// The one thing that removes the tilt exactly is wrapping the exclusion
// around the dial, and it is rejected on purpose - it would forbid
// following a target near one end with one near the other, which is the
// best transition the game has.
export const MIN_GAP = BAND_3;

// Everything is worked in tenths as integers. The dial's resolution is
// 0.1, and doing the arithmetic in floats and rounding at the end is how
// a value lands 11.999999 from the last one and slips under a rule that
// says 12.
const TENTH = 10;
const LO10 = Math.round(EDGE_MARGIN * TENTH);
const HI10 = Math.round((DIAL_MAX - EDGE_MARGIN) * TENTH);

// `avoid` is the previous round's target, when there is one.
//
// Drawn from the allowed span DIRECTLY rather than by drawing and
// re-rolling until it is far enough away. Rejection sampling would be
// simpler to write and would have two problems worth avoiding in a
// reducer: it consumes an unpredictable number of values from a stream
// the whole game is recomputed from, and it has no guaranteed end. This
// picks one number from the two allowed stretches, so it is exactly
// uniform over what is permitted, always terminates, and costs one draw.
function pickTarget(random: () => number, avoid: number | null = null): number {
  if (avoid === null) return Math.round(LO10 + random() * (HI10 - LO10)) / TENTH;

  const gap = Math.round(MIN_GAP * TENTH);
  const at = Math.round(avoid * TENTH);
  // The two stretches left over once the forbidden window is cut out.
  const lowEnd = Math.min(HI10, at - gap);
  const highStart = Math.max(LO10, at + gap);
  const lowSpan = Math.max(0, lowEnd - LO10 + 1);
  const highSpan = Math.max(0, HI10 - highStart + 1);

  // Cannot happen with MIN_GAP this size - the narrowest case leaves 713
  // positions - but a future gap set too wide should degrade to "ignore
  // the rule" rather than to a wedge stuck at one end of the dial.
  if (lowSpan + highSpan <= 0) return Math.round(LO10 + random() * (HI10 - LO10)) / TENTH;

  const pick = Math.floor(random() * (lowSpan + highSpan));
  const chosen = pick < lowSpan ? LO10 + pick : highStart + (pick - lowSpan);
  return Math.min(HI10, Math.max(LO10, chosen)) / TENTH;
}

function pickCard(cards: Spectrum[], seen: string[], random: () => number): Spectrum {
  // Once every card has been used the deck starts again rather than
  // running out. A session that outlasts the deck is a good problem.
  const fresh = cards.filter((c) => !seen.includes(c.id));
  const pool = fresh.length > 0 ? fresh : cards;
  return pool[Math.floor(random() * pool.length) % pool.length];
}

// THE SEED IS NOT PART OF THE STATE, and that is deliberate rather than
// tidy. The state is the thing that gets broadcast, and the seed plus the
// round plus the scores - all of which are on the wire already - is enough
// to recompute the target. A seed riding along in the payload would undo
// the entire redaction one round at a time.
//
// So the board holds it and hands it to reduce(); a secret that is not in
// the object cannot leak out of the object.
export function startGame(
  cards: Spectrum[],
  deckKey: string,
  names: string[],
  seed: string,
  mode: Mode = "teams",
  // How long a co-op run is. Left out it is the standard five; a written
  // deck passes its own length, which is what makes "your own" a run
  // through your own list rather than five rounds of it.
  runLength: number = COOP_ROUNDS,
): WavelengthState {
  const random = rng(seed);
  const card = pickCard(cards, [], random);
  return {
    deck: deckKey,
    mode,
    pot: 0,
    runLength: mode === "coop" ? Math.max(1, Math.round(runLength)) : 0,
    teams: names.map((name) => ({ name, score: 0 })),
    psychic: 0,
    round: 1,
    phase: "clue",
    card,
    seen: [card.id],
    target: pickTarget(random),
    peek: "shut",
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
  | { type: "peek"; at: "open" | "closing" | "shut" }
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
  // The game's own seed, for dealing the next round. Required rather than
  // defaulted: a caller that forgets it would silently go back to dealing
  // every game the same cards, which is exactly the bug this replaced.
  seed: string,
): WavelengthState {
  if (action.type === "peek") {
    // Only ever before the reveal. After it the wedge is on screen for
    // everyone anyway, and a lid that could shut again over a revealed
    // target would just be a way to hide the result.
    if (state.phase === "reveal" || state.phase === "done") return state;
    if (state.peek === action.at) return state;
    return { ...state, peek: action.at };
  }

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
    // THE CLUE IS NOT REQUIRED. It used to be - the dial stayed dead until
    // something had been typed - which is exactly backwards for the way
    // this actually gets played: the clue is SAID, out loud, and everybody
    // in the room and on the stream already heard it. Typing it in is for
    // when you want it on the graphic for a clip, not a toll gate on the
    // rest of the round.
    if (state.phase === "clue") return { ...state, phase: "guess", guess: value };
    return { ...state, guess: value };
  }

  if (action.type === "steal") {
    // Nobody to call it in co-op - the other side of the table is on your
    // side of the table.
    if (state.mode === "coop") return state;
    // The dial has to be somewhere before there are sides to choose
    // between.
    if (state.phase !== "guess" || state.guess === null) return state;
    return { ...state, phase: "steal", steal: action.side };
  }

  if (action.type === "reveal") {
    // FROM EITHER PHASE. Calling a side is a move you may want to skip -
    // and in co-op there is no side to call at all - so the reveal is
    // reachable as soon as the dial is somewhere. Requiring the call first
    // made a two-press round into a four-press one.
    if (state.phase !== "guess" && state.phase !== "steal") return state;
    if (state.guess === null || state.target === null) return state;
    const band = bandFor(state.target, state.guess);
    const stolen = state.steal !== null && stealHits(state.target, state.guess, state.steal);

    if (state.mode === "coop") {
      const pot = state.pot + band;
      // A run is over when its rounds are used up, however it went.
      const over = state.round >= state.runLength;
      return { ...state, phase: over ? "done" : "reveal", pot, scored: { band, stolen: false } };
    }

    const teams = state.teams.map((t, i) => ({
      ...t,
      score: t.score + (i === state.psychic ? band : stolen ? 1 : 0),
    }));
    const over = teams.some((t) => t.score >= WIN_SCORE);
    return { ...state, phase: over ? "done" : "reveal", teams, scored: { band, stolen } };
  }

  if (action.type === "next") {
    if (state.phase !== "reveal") return state;
    // SEEDED FROM THIS GAME, not just from where the game has got to.
    // It used to be `${deck}:${round}:${scores}` with no game seed in it,
    // which meant round two after a scoreless round one dealt the same
    // target in every game ever played - ten differently-seeded games all
    // came back with 18.5, measured. The round and the scores are still in
    // there so a round does not depend on how long the last one took.
    const random = rng(`${seed}:${state.deck}:${state.round}:${state.teams.map((t) => t.score).join("-")}`);

    // A PAIRED RUN KEEPS THE CARD FOR A SECOND GO. The run is exactly two
    // rounds per card, so the odd rounds deal and the even ones hand the
    // same card to the other person - fresh target, other psychic. Worked
    // out from the numbers rather than carried as a flag: a run that is
    // twice the deck is a run through the deck twice.
    const paired = state.mode === "coop" && state.runLength === cards.length * 2;
    const card = paired && state.round % 2 === 1 ? state.card : pickCard(cards, state.seen, random);
    return {
      ...state,
      round: state.round + 1,
      psychic: (state.psychic === 0 ? 1 : 0) as TeamIndex,
      phase: "clue",
      card,
      seen: [...state.seen, card.id].slice(-cards.length),
      // Kept clear of where it just was - see MIN_GAP. The round that has
      // only just been revealed is the one still in everybody's eye.
      target: pickTarget(random, state.target),
      peek: "shut",
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
// The board holds the target from the moment the card comes up, and the
// rule is that it is not in the MESSAGE until it is allowed to be seen -
// not that the graphic declines to draw it. A number in the payload is a
// number anybody who opens the browser source can read, and that URL
// lives in an OBS config and gets screen-shared.
//
// TWO MOMENTS IT IS ALLOWED, and the second one is a deliberate trade:
//
//   the reveal, obviously; and
//
//   while the lid is UP. The psychic opening the dial is a beat everybody
//   is meant to see now - the stream and whoever is on the join link - so
//   for those couple of seconds the answer really is on the wire. That is
//   the cost of showing it, and it is the whole cost: it buys the moment
//   where the room watches somebody look at the answer.
//
// Which means the join link is no longer safe to hand to somebody who
// must not know. It is a link for the people playing.
export function redactFor(state: WavelengthState): WavelengthState {
  if (state.phase === "reveal" || state.phase === "done") return state;
  if (state.peek !== "shut") return state;
  return { ...state, target: null };
}

// WHAT A SCREEN DOES WITH A STATE IT WAS HANDED, and it lives here rather
// than inside the graphic for one reason: this is the thing that broke.
//
// A recording went out where the overlay never showed the psychic opening
// the dial. The rules were right, the message was right - but nothing
// tested the step in between, because the only place that decision existed
// was inside a React component nothing but a browser could call. It is a
// pure function of the state now, so the wire test can round-trip a real
// board state through JSON and ask the graphic's own code what it would
// have drawn.
export function lidFor(state: WavelengthState): { open: boolean; wedge: boolean } {
  const revealed = state.phase === "reveal" || state.phase === "done";
  return {
    // The lid is only DRAWN open on "open"...
    open: revealed || state.peek === "open",
    // ...but the wedge outlives the shutter on the way down, or it blinks
    // out from under a lid that is still travelling.
    wedge: revealed || state.peek !== "shut",
  };
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
  // In co-op the pair are on the same side, so the dial never changes
  // hands - the psychic is simply the one who may not touch it.
  if (state.phase === "guess") {
    if (state.mode === "coop") return other(state.psychic);
    return state.guess === null ? state.psychic : other(state.psychic);
  }
  return null;
}

export function other(team: TeamIndex): TeamIndex {
  return team === 0 ? 1 : 0;
}
