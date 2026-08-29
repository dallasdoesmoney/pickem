import { supabase } from "@/lib/supabase/client";

// Nameplate's record. Derived from the guesses on every call rather than
// stored - see 0058_nameplate_stats.sql for why there is no stats table.
//
// winRate and avgGuesses are null until there is something to average.
// Not zero: a zero win rate is a claim about somebody who has lost, and
// somebody who has not played has not lost.
export type NameplateStats = {
  played: number;
  won: number;
  winRate: number | null;
  avgGuesses: number | null;
  currentStreak: number;
  maxStreak: number;
  solvedToday: boolean;
  maxGuesses: number;
  // 1..maxGuesses, every bucket present even at zero.
  distribution: Record<string, number>;
};

// Numeric columns come back from PostgREST as strings when they are
// wider than a JS number can hold - avg() and a division both are. So
// both are parsed rather than trusted, and a value that will not parse
// becomes null rather than NaN, which would render as "NaN%".
function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function fetchNameplateStats(): Promise<NameplateStats | null> {
  const { data, error } = await supabase.rpc("nameplate_stats");
  if (error) throw error;
  if (!data) return null;
  const d = data as Record<string, unknown>;
  return {
    played: num(d.played) ?? 0,
    won: num(d.won) ?? 0,
    winRate: num(d.winRate),
    avgGuesses: num(d.avgGuesses),
    currentStreak: num(d.currentStreak) ?? 0,
    maxStreak: num(d.maxStreak) ?? 0,
    solvedToday: d.solvedToday === true,
    maxGuesses: num(d.maxGuesses) ?? 8,
    distribution: (d.distribution as Record<string, number>) ?? {},
  };
}
