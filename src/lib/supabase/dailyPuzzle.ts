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
