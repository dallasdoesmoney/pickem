import { TeamAbbr, TEAMS, Conference, Division } from "@/data/teams";
import { QUARTERBACKS } from "@/data/rosters/qbs";
import { RUNNING_BACKS } from "@/data/rosters/rbs";
import { WIDE_RECEIVERS } from "@/data/rosters/wrs";
import { TIGHT_ENDS } from "@/data/rosters/tes";
import { KICKERS } from "@/data/rosters/ks";

// The pool the daily player puzzle draws from and guesses against: every
// synced roster, flattened, with the position each file already implies.
//
// This is a view over the roster files rather than a list of its own, so
// the weekly sync keeps it current for free and there is no second place
// to remember to update when someone is traded.
//
// The DATABASE holds a copy of this (see
// supabase/migrations/0046_daily_player_puzzle.sql) because the answer
// and the grading both have to live server-side - a client that can see
// today's player has no puzzle. Regenerate that copy with
// `node scripts/gen-puzzle-seed.mjs` after a roster sync; the two drift
// apart otherwise, and the symptom is a guess the server says it has
// never heard of.

export type PuzzlePosition = "QB" | "RB" | "WR" | "TE" | "K";

export type PuzzlePlayer = {
  espnId: string;
  name: string;
  team: TeamAbbr;
  position: PuzzlePosition;
  conference: Conference;
  division: Division;
  // Optional on purpose. The roster sync currently keeps only id, name
  // and team; these light up once scripts/sync-players.mjs is run with
  // the wider field set it now captures. Every hint column checks for
  // its own value, so the puzzle plays with four columns today and more
  // later without any of this being rewritten.
  heightIn?: number;
  weightLb?: number;
  age?: number;
  jersey?: number;
  college?: string;
};

type RosterRow = {
  espnId: string;
  name: string;
  team: TeamAbbr;
  heightIn?: number;
  weightLb?: number;
  age?: number;
  jersey?: number;
  college?: string;
};

function withTeam<T extends RosterRow>(rows: T[], position: PuzzlePosition): PuzzlePlayer[] {
  return rows.map((r) => ({
    espnId: r.espnId,
    name: r.name,
    team: r.team,
    position,
    conference: TEAMS[r.team].conference,
    division: TEAMS[r.team].division,
    // Forwarded rather than dropped even though the board is graded
    // server-side and never reads these here: a type that claims a field
    // and never carries one is a trap for whatever uses it next.
    heightIn: r.heightIn,
    weightLb: r.weightLb,
    age: r.age,
    jersey: r.jersey,
    college: r.college,
  }));
}

export const PUZZLE_PLAYERS: PuzzlePlayer[] = [
  ...withTeam(QUARTERBACKS, "QB"),
  ...withTeam(RUNNING_BACKS, "RB"),
  ...withTeam(WIDE_RECEIVERS, "WR"),
  ...withTeam(TIGHT_ENDS, "TE"),
  ...withTeam(KICKERS, "K"),
]
  // A player can hold two roster slots (a backup listed at two spots, or
  // a mid-season move landing them in both files before the next sync).
  // Two rows for one man would let the same guess be typed twice and
  // would put a duplicate in the dropdown.
  .filter((p, i, all) => all.findIndex((q) => q.espnId === p.espnId) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

export const PUZZLE_PLAYERS_BY_ID = new Map(PUZZLE_PLAYERS.map((p) => [p.espnId, p]));

// ESPN keys headshots on the same id the roster rows carry.
export function playerHeadshot(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}
