import { supabase } from "@/lib/supabase/client";

// 'unknown' is not a miss. It means one side of the comparison has no
// value yet - the roster sync has not filled in height and weight - and
// telling someone they guessed wrong on a column nobody knows would be a
// lie they could act on.
export type Verdict = "hit" | "close" | "miss" | "unknown";

export type TextCell = { value: string; status: Verdict };
export type NumCell = { value: number | null; status: Verdict; direction: "up" | "down" | null };

export type PuzzleGuess = {
  espnId: string;
  name: string;
  correct: boolean;
  team: TextCell;
  conference: TextCell;
  division: TextCell;
  position: TextCell;
  height: NumCell;
  weight: NumCell;
  age: NumCell;
  jersey: NumCell;
  // Same shape as the numeric cells so the board can treat every column
  // alike; direction is always null, because there is no "warmer" for a
  // college.
  college: { value: string | null; status: Verdict; direction: null };
};

export type PuzzleState = {
  puzzleOn: string;
  // Which board this is, counted from the first day anybody ever played
  // - see 0059_puzzle_number.sql. Optional because a guest board is
  // built in the browser and fills it in from its own call.
  puzzleNumber?: number;
  maxGuesses: number;
  guessesUsed: number;
  guesses: PuzzleGuess[];
  solved: boolean;
  finished: boolean;
  pointsAwarded: number;
  // Null until the round is over. The server withholds it rather than the
  // client hiding it - see supabase/migrations/0046_daily_player_puzzle.sql.
  answer: { espnId: string; name: string; team: string; position: string } | null;
};

// Today's board. Creates the day's puzzle on the first call of the day,
// so nothing else has to schedule anything.
export async function fetchDailyPuzzle(): Promise<PuzzleState> {
  const { data, error } = await supabase.rpc("daily_puzzle_state");
  if (error) throw error;
  return data as PuzzleState;
}

// Returns the whole board back, not a delta, so the caller replaces what
// it holds rather than merging.
export async function submitDailyGuess(espnId: string): Promise<PuzzleState> {
  const { data, error } = await supabase.rpc("submit_daily_guess", { p_espn_id: espnId });
  if (error) throw error;
  return data as PuzzleState;
}

// ---------------------------------------------------------------- guests
//
// A signed-out player gets the same board and the same grading; what they
// do not get is a record. The server grades one guess and forgets it (see
// 0051_guest_play.sql), and the browser keeps the running board until
// either the day rolls over or an account turns up to hand it to.
const GUEST_KEY = "pickem:daily-guest";

// A guest's board is assembled in the browser, so the number has to be
// asked for separately - it is the one fact about the day that only the
// database knows. One small call on load, and only when signed out.
export async function fetchPuzzleNumber(puzzleOn: string): Promise<number | null> {
  const { data, error } = await supabase.rpc("puzzle_number", { p_on: puzzleOn });
  if (error) throw error;
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}

export async function submitGuestGuess(espnId: string): Promise<PuzzleGuess> {
  const { data, error } = await supabase.rpc("puzzle_guest_compare", { p_espn_id: espnId });
  if (error) throw error;
  return data as PuzzleGuess;
}

// ------------------------------------------------------------ unlimited
//
// One guess graded against an answer the CALLER supplies, which is the
// whole difference. The daily withholds its answer because there is a
// record and a payout riding on it; unlimited has neither, so the browser
// can hold the answer and there is no round to store, expire or clean up.
//
// The grading is still the server's - this reaches the same
// puzzle_compare submit_daily_guess uses - so a yellow means the same
// thing in both modes and cannot drift when a band is retuned. See
// supabase/migrations/0057_practice_mode.sql.
export async function submitPracticeGuess(espnId: string, answerId: string): Promise<PuzzleGuess> {
  const { data, error } = await supabase.rpc("puzzle_practice_compare", { p_guess: espnId, p_answer: answerId });
  if (error) throw error;
  return data as PuzzleGuess;
}

// Keyed by date so yesterday's board is not sitting there tomorrow, and
// so the storage cannot silently grow one entry per day forever - reading
// today's key is what clears every other one.
export function readGuestGuesses(puzzleOn: string): PuzzleGuess[] {
  try {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return [];
    const held = JSON.parse(raw) as { on?: string; guesses?: PuzzleGuess[] };
    if (held.on !== puzzleOn || !Array.isArray(held.guesses)) {
      localStorage.removeItem(GUEST_KEY);
      return [];
    }
    return held.guesses;
  } catch {
    // Hand-edited, or storage is off. A guest with no history is the
    // same as a guest who has not played, which is a survivable place to
    // land - unlike throwing on a page load.
    return [];
  }
}

export function writeGuestGuesses(puzzleOn: string, guesses: PuzzleGuess[]): void {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ on: puzzleOn, guesses }));
  } catch {
    // Private mode or quota. Losing the board on reload is bad; refusing
    // to accept the guess that was just made is worse.
  }
}

export function clearGuestGuesses(): void {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    // Nothing to recover - the read side treats junk as "no history".
  }
}

// Today's date the way the database reckons it, so the browser and the
// server agree on which day a held board belongs to. The puzzle rolls at
// midnight in New York (puzzle_today()), not at midnight wherever the
// player happens to be.
export function puzzleToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}
