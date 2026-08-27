import { TeamAbbr, TEAMS, Conference, Division } from "@/data/teams";
import { ACTIVE_PLAYERS } from "@/data/rosters/all";
import { QUARTERBACKS } from "@/data/rosters/qbs";
import { RUNNING_BACKS } from "@/data/rosters/rbs";
import { WIDE_RECEIVERS } from "@/data/rosters/wrs";
import { TIGHT_ENDS } from "@/data/rosters/tes";

// TWO POOLS, and they are not the same set.
//
//   GUESSABLE  every quarterback, running back, receiver and tight end on
//              an NFL roster - about 925 of them. Backups included: if
//              you want to spend a guess on a third-string quarterback to
//              rule out a division, that is a legitimate way to play and
//              the game should not stop you.
//
//   ANSWERABLE only the starters - one QB, one RB, one TE and THREE
//              receivers a team, 192 in all. The answer has to be
//              somebody a person could name, and a fourth tight end is
//              not that.
//
// They were the same set until now, which meant the only players you
// could guess were the ones who could be the answer. That is a much
// smaller game than it looks: eight guesses out of 160 candidates is a
// different puzzle to eight out of 925, and it also made a guess that
// merely eliminates - "is he even in the AFC?" - impossible to spend.
//
// A rank and not "on the chart": ESPN ranks essentially the whole roster,
// so mere presence marked 2,985 of 3,021 and selected nothing.
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
  position: string;
  conference: Conference;
  division: Division;
  // Kept even though classic mode makes it true for everybody: the
  // database column exists for hard mode, and the two want the same
  // shape.
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

// A row as the position files store it - no position, because the file
// it lives in is the position.
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

// THE ANSWER POOL. These players can be the answer; everybody else at
// these positions can only be guessed.
//
// The membership comes from the four position files, NOT from filtering
// the full roster by depth-chart rank. That was the first attempt and it
// was wrong twice over.
//
// Wrong on WR, because ESPN splits receivers across separate left, right
// and slot entries that each rank their own occupant first - so "rank 1"
// is two or three receivers a team and they are the wrong ones.
// Cincinnati's rank 1 is Ja'Marr Chase and Charlie Jones, with TEE
// HIGGINS at rank 2. syncPosition already solves this properly: it takes
// two a team by rank and then by the order the chart lists the slots,
// which lands on Chase and Higgins, Rice and Worthy, Jefferson and
// Addison. Exactly WR1 and WR2.
//
// And wrong on coverage, because three teams came back from the last
// depth-chart sync with ranks for their defence and NONE at QB, RB, WR or
// TE - which would have quietly dropped Philadelphia, New England and
// Pittsburgh out of the game entirely. The position files have all 32
// teams at all four positions.
//
// So: 32 quarterbacks, 32 running backs, 32 tight ends, and three
// receivers a team - 192 players once the roster sync has been run with
// WIDE_RECEIVERS at three per team. Until then wrs.ts holds two apiece
// and this is 160; the shape does not change, only the count.
const STARTERS: { espnId: string; position: string; row: RosterRow }[] = [
  ...QUARTERBACKS.map((row) => ({ espnId: row.espnId, position: "QB", row })),
  ...RUNNING_BACKS.map((row) => ({ espnId: row.espnId, position: "RB", row })),
  ...WIDE_RECEIVERS.map((row) => ({ espnId: row.espnId, position: "WR", row })),
  ...TIGHT_ENDS.map((row) => ({ espnId: row.espnId, position: "TE", row })),
];

// The full roster, by id, for the hints. The position files come off the
// depth-chart path, where college is a $ref rather than a value - only 15
// of the 160 carry one - so the COLLEGE column would be empty on the
// board that has it. all.ts comes off the roster endpoint and has a
// college for every one of them, so membership is taken from one place
// and the attributes from the other.
//
// This is also why the full roster is still synced and still in the
// database when classic mode uses a twentieth of it: hard mode wants all
// of it, and these hints want the rest.
const BY_ID = new Map(ACTIVE_PLAYERS.map((p) => [p.espnId, p]));

const STARTER_IDS = new Set(STARTERS.map((m) => m.espnId));

// The positions you can guess at. Everything else on a roster - guards,
// safeties, long snappers - is off the board entirely: nobody is going
// to type a third-string centre's name into a game about skill players,
// and 2,100 of them in the dropdown makes the search worse for everyone.
const GUESSABLE_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);

// Everybody guessable, starters first so the de-dupe below keeps the row
// that knows a player is a starter.
//
// The starters are appended rather than assumed to be in all.ts: a fresh
// clone has an empty roster file and falls back to the position files
// alone, which plays the same game with 160 names instead of 925 rather
// than no game at all.
const GUESS_POOL: { espnId: string; position: string; row: RosterRow }[] = [
  ...STARTERS,
  ...ACTIVE_PLAYERS.filter((p) => GUESSABLE_POSITIONS.has(p.position)).map((p) => ({
    espnId: p.espnId,
    position: p.position,
    row: p as RosterRow,
  })),
];

export const PUZZLE_PLAYERS: PuzzlePlayer[] = GUESS_POOL
  // A player can hold two slots - a receiver listed outside and in the
  // slot - and would otherwise appear twice in the dropdown and let the
  // same guess be spent twice.
  .filter((m, i, all) => all.findIndex((q) => q.espnId === m.espnId) === i)
  .map(({ espnId, position, row }) => {
    // The full roster where it has been synced, the position file where
    // it has not. A fresh clone and a preview deploy get the second one
    // and play the same 160-player game with a thinner set of hints,
    // rather than no game at all.
    const full = BY_ID.get(espnId);
    const team = (full?.team ?? row.team) as TeamAbbr;
    return {
      espnId,
      name: full?.name ?? row.name,
      team,
      position,
      conference: TEAMS[team].conference,
      division: TEAMS[team].division,
      answerable: STARTER_IDS.has(espnId),
      heightIn: full?.heightIn ?? row.heightIn,
      weightLb: full?.weightLb ?? row.weightLb,
      age: full?.age ?? row.age,
      jersey: full?.jersey ?? row.jersey,
      college: full?.college ?? row.college,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export const PUZZLE_PLAYERS_BY_ID = new Map(PUZZLE_PLAYERS.map((p) => [p.espnId, p]));

// Re-exported so callers that already hold a player can reach for the
// URL here; the function itself lives in its own module so anything that
// needs ONLY the URL does not pull this whole list in with it.
export { playerHeadshot } from "@/lib/espnHeadshot";
