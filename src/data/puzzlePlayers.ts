import { TeamAbbr, TEAMS, Conference, Division } from "@/data/teams";
import { ACTIVE_PLAYERS } from "@/data/rosters/all";
import { QUARTERBACKS } from "@/data/rosters/qbs";
import { RUNNING_BACKS } from "@/data/rosters/rbs";
import { WIDE_RECEIVERS } from "@/data/rosters/wrs";
import { TIGHT_ENDS } from "@/data/rosters/tes";
import { KICKERS } from "@/data/rosters/ks";

// The pool the daily puzzle draws from, and the one it grades guesses
// against. They are not the same pool, and that is the design:
//
//   guessable   every active player, ~1,700
//   answerable  the ones ESPN's depth chart mentions, ~400-600
//
// An answer pool of everybody would include third-string guards and
// practice-squad safeties, and no set of hints rescues a player nobody
// can name. Poeltl and Weddle draw the same line. Guessing stays wide
// open, because being told "not a player" when you have named a real one
// is the most annoying thing these games do.
//
// The DATABASE holds a copy of this (see
// supabase/migrations/0046_daily_player_puzzle.sql) because the answer
// and the grading both have to live server-side - a client that can see
// today's player has no puzzle. Regenerate that copy with
// `node scripts/gen-puzzle-seed.mjs` after a roster sync; the two drift
// apart otherwise, and the symptom is a guess the server says it has
// never heard of.

export type PuzzlePlayer = {
  espnId: string;
  name: string;
  team: TeamAbbr;
  // ESPN's own abbreviation once the full roster has been synced - OT,
  // CB, EDGE and the rest, not just the five skill buckets.
  position: string;
  conference: Conference;
  division: Division;
  // Whether this player can be the answer, as opposed to merely a legal
  // guess.
  answerable: boolean;
  // Optional: ESPN does not publish all of these for everyone. Each hint
  // column checks for its own value and hides itself when nothing has
  // one.
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

function fromPositionFile(rows: RosterRow[], position: string): PuzzlePlayer[] {
  return rows.map((r) => ({
    espnId: r.espnId,
    name: r.name,
    team: r.team,
    position,
    conference: TEAMS[r.team].conference,
    division: TEAMS[r.team].division,
    // Everyone in these files is a depth-chart pick by construction -
    // that is how syncPosition chooses them.
    answerable: true,
    heightIn: r.heightIn,
    weightLb: r.weightLb,
    age: r.age,
    jersey: r.jersey,
    college: r.college,
  }));
}

// The five position files, as a pool. Used only until the full roster has
// been synced once - an unsynced checkout plays a 192-player game rather
// than no game, which matters because that is also what a fresh clone and
// a preview deploy look like.
const FROM_POSITION_FILES: PuzzlePlayer[] = [
  ...fromPositionFile(QUARTERBACKS, "QB"),
  ...fromPositionFile(RUNNING_BACKS, "RB"),
  ...fromPositionFile(WIDE_RECEIVERS, "WR"),
  ...fromPositionFile(TIGHT_ENDS, "TE"),
  ...fromPositionFile(KICKERS, "K"),
];

const FROM_FULL_ROSTER: PuzzlePlayer[] = ACTIVE_PLAYERS.map((p) => ({
  espnId: p.espnId,
  name: p.name,
  team: p.team,
  position: p.position,
  conference: TEAMS[p.team].conference,
  division: TEAMS[p.team].division,
  answerable: p.answerable,
  heightIn: p.heightIn,
  weightLb: p.weightLb,
  age: p.age,
  jersey: p.jersey,
  college: p.college,
}));

export const PUZZLE_PLAYERS: PuzzlePlayer[] = (FROM_FULL_ROSTER.length ? FROM_FULL_ROSTER : FROM_POSITION_FILES)
  // A player can hold two roster slots, or appear on two teams' pages
  // mid-trade. Two rows for one man would put a duplicate in the dropdown
  // and let the same guess be spent twice.
  .filter((p, i, all) => all.findIndex((q) => q.espnId === p.espnId) === i)
  .sort((a, b) => a.name.localeCompare(b.name));

export const PUZZLE_PLAYERS_BY_ID = new Map(PUZZLE_PLAYERS.map((p) => [p.espnId, p]));

// ESPN keys headshots on the same id the roster rows carry.
export function playerHeadshot(espnId: string): string {
  return `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;
}
