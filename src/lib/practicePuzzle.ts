import { PUZZLE_PLAYERS, PuzzlePlayer } from "@/data/puzzlePlayers";
import { PuzzleGuess, PuzzleState } from "@/lib/supabase/dailyPuzzle";

// Unlimited mode, browser side: which player a round is about, and what
// the board looks like partway through one.
//
// The daily's equivalents are a database table and an RPC, because a day
// is a fact everybody has to agree on and a payout has to be defended. A
// practice round is agreed with nobody and pays nothing, so it lives
// here and dies with the tab.

// The answer pool is the same one the daily draws from - starters, the
// players somebody could actually name. Practice against a third-string
// long snapper is not an easier version of this game, it is a different
// and worse one.
const ANSWERS = PUZZLE_PLAYERS.filter((p) => p.answerable);

// Eight, the same as the daily. The mode is unlimited in ROUNDS, not in
// guesses: take the cap off and there is no reason to think, and the
// thing the practice is meant to practise is the thinking.
export const PRACTICE_MAX_GUESSES = 8;

// How many recent answers to keep out of the draw. Uniform random over
// ~190 players deals a repeat inside ten rounds about a quarter of the
// time, and a repeat is worse than it sounds here - you do not get an
// easier round, you get a round you already know the answer to.
//
// Twenty is enough to make a session feel like it is working through the
// league without narrowing the pool far enough to be a hint in itself.
const AVOID_RECENT = 20;
const RECENT_KEY = "pickem:daily-practice-recent";

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const held = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(held) ? held.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // Hand-edited, or storage is off. No history is the same as a first
    // round, which is a fine place to land.
    return [];
  }
}

function rememberRecent(espnId: string): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([espnId, ...readRecent()].slice(0, AVOID_RECENT)));
  } catch {
    // Losing the no-repeat memory costs an occasional repeated player.
    // Refusing to start the round would cost the round.
  }
}

// Picks the next round's answer and records it against repeats.
//
// The filter is dropped if it would leave nothing, which cannot happen
// at 190 players against 20 but would the moment somebody shrinks the
// answer pool - and "no players left" must never be how that shows up.
export function pickPracticeAnswer(): PuzzlePlayer {
  const recent = new Set(readRecent());
  const pool = ANSWERS.filter((p) => !recent.has(p.espnId));
  const from = pool.length > 0 ? pool : ANSWERS;
  const pick = from[Math.floor(Math.random() * from.length)];
  rememberRecent(pick.espnId);
  return pick;
}

// The same shape the daily hands back, so every part of the board -
// rows, chips, legend, celebration - renders a practice round without
// knowing it is one.
//
// The one honest difference is `answer`. The daily withholds it from a
// guest who loses, because telling them would mean an endpoint that
// hands today's player to anybody who asks. Here the browser already has
// it, nothing is spoiled by saying so, and being shown who it was is the
// entire point of practising.
export function practiceBoard(answer: PuzzlePlayer, guesses: PuzzleGuess[]): PuzzleState {
  const solved = guesses.some((g) => g.correct);
  const finished = solved || guesses.length >= PRACTICE_MAX_GUESSES;
  return {
    // Not a date. Nothing keys off this in practice - the share path is
    // not offered and no storage is written - and putting today's date
    // on a round that is not today's would be the wrong kind of true.
    puzzleOn: "practice",
    maxGuesses: PRACTICE_MAX_GUESSES,
    guessesUsed: guesses.length,
    guesses,
    solved,
    finished,
    // Nothing is paid for a round nobody is keeping.
    pointsAwarded: 0,
    answer: finished
      ? { espnId: answer.espnId, name: answer.name, team: answer.team, position: answer.position }
      : null,
  };
}
