// Regenerates supabase/seeds/puzzle_players.sql from the roster files.
//
// The daily puzzle's answer and its grading both live server-side - a
// client that can see today's player has no puzzle - so Postgres needs
// its own copy of the pool. This script is what keeps that copy honest.
//
//   node scripts/gen-puzzle-seed.mjs
//
// Run it after any roster sync, then paste the generated file into the
// Supabase SQL Editor. Skipping it is survivable but visible: a traded
// player keeps their old team in the hints, and a newly-signed one is a
// name the dropdown offers and the server rejects.
//
// It parses the roster files with a regex rather than importing them,
// because they are TypeScript and this is a plain node script - the same
// approach sync-players.mjs takes when it rewrites them.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  ["qbs", "QB"],
  ["rbs", "RB"],
  ["wrs", "WR"],
  ["tes", "TE"],
  ["ks", "K"],
];

// Divisions live in one place, src/data/teams.ts, and are read back out
// of it rather than restated here - a second copy is a second thing to
// get wrong.
function readDivisions() {
  const src = readFileSync(join(ROOT, "src/data/teams.ts"), "utf8");
  const re = /^ {2}([A-Z]{2,3}): \{.*?conference: "(AFC|NFC)", division: "(East|North|South|West)"/gm;
  const map = new Map();
  let m;
  while ((m = re.exec(src))) map.set(m[1], { conference: m[2], division: m[3] });
  if (map.size !== 32) throw new Error(`expected 32 teams in teams.ts, found ${map.size}`);
  return map;
}

// The full roster, once it has been synced. Returns [] when the file is
// still the empty placeholder, and the caller falls back to the five
// position files - the same fallback src/data/puzzlePlayers.ts makes, and
// it has to be the same or the app offers players the server rejects.
// Read back out of puzzlePlayers.ts rather than restated here. The app
// and this script must agree on who can be the answer, and two copies of
// a threshold are two things to get wrong.
// Classic mode's membership: the four position files, which is what
// syncPosition builds them for - one QB, RB and TE a team, and the two
// receivers the depth chart ranks first and second across its separate
// outside and slot entries.
//
// NOT a depth-rank filter over all.ts. That was tried and it was wrong on
// WR (rank 1 alone gives Chase and Charlie Jones, leaving Tee Higgins at
// rank 2) and wrong on coverage (three teams came back from the last sync
// with no ranks at all at these four positions). See puzzlePlayers.ts.
const CLASSIC_FILES = [
  ["qbs", "QB"],
  ["rbs", "RB"],
  ["wrs", "WR"],
  ["tes", "TE"],
];

function readClassicMembers() {
  const out = [];
  for (const [file, position] of CLASSIC_FILES) {
    for (const row of readRoster(file)) out.push({ ...row, position });
  }
  return out;
}

// The full roster, for the hints. Membership is decided by the position
// files above; this is only where the values come from.
function readAllPlayers() {
  const src = readFileSync(join(ROOT, "src/data/rosters/all.ts"), "utf8");
  const re = /\{ espnId: "([^"]+)", name: "([^"]+)", team: "([A-Z]{2,3})", position: "([^"]*)"([^}]*)\}/g;
  const rows = [];
  let m;
  while ((m = re.exec(src))) {
    rows.push({
      espnId: m[1],
      name: m[2],
      team: m[3],
      position: m[4],
      ...extrasFrom(m[5] ?? ""),
    });
  }
  return rows;
}

// The optional hint columns, however they were written.
function extrasFrom(extra) {
  const num = (key) => {
    const hit = extra.match(new RegExp(`${key}: (\\d+)`));
    return hit ? Number(hit[1]) : null;
  };
  const str = (key) => {
    const hit = extra.match(new RegExp(`${key}: "([^"]*)"`));
    return hit ? hit[1] : null;
  };
  return {
    heightIn: num("heightIn"),
    weightLb: num("weightLb"),
    age: num("age"),
    jersey: num("jersey"),
    college: str("college"),
    depthRank: num("depthRank"),
  };
}

function readRoster(file) {
  const src = readFileSync(join(ROOT, `src/data/rosters/${file}.ts`), "utf8");
  const re = /\{ espnId: "([^"]+)", name: "([^"]+)", team: "([A-Z]{2,3})"([^}]*)\}/g;
  const rows = [];
  let m;
  while ((m = re.exec(src))) {
    rows.push({ espnId: m[1], name: m[2], team: m[3], ...extrasFrom(m[4] ?? "") });
  }
  return rows;
}

const divisions = readDivisions();
const seen = new Set();
const players = [];

// Membership from the position files, attributes from the full roster:
// the position files come off the depth-chart path where college is a
// $ref rather than a value, so only 15 of the 160 carry one, and the
// COLLEGE column would be empty on the board that has it.
const members = readClassicMembers();
const full = new Map(readAllPlayers().map((p) => [p.espnId, p]));
const source = members.map((m) => {
  const rich = full.get(m.espnId);
  return {
    ...m,
    // Position stays the position FILE's, which is the one that decided
    // this player is in the pool at all.
    position: m.position,
    name: rich?.name ?? m.name,
    team: rich?.team ?? m.team,
    heightIn: rich?.heightIn ?? m.heightIn,
    weightLb: rich?.weightLb ?? m.weightLb,
    age: rich?.age ?? m.age,
    jersey: rich?.jersey ?? m.jersey,
    college: rich?.college ?? m.college,
    // Classic draws no line between answering and guessing. Both columns
    // are written anyway, because hard mode is where they come apart and
    // the schema should not need changing again for it.
    answerable: true,
    guessable: true,
  };
});

for (const row of source) {
  // Same de-duplication as src/data/puzzlePlayers.ts, and it has to
  // match: a row here that the app does not offer is unguessable, and
  // one the app offers that is missing here is rejected on guess.
  if (seen.has(row.espnId)) continue;
  seen.add(row.espnId);
  const div = divisions.get(row.team);
  if (!div) throw new Error(`${row.name} is on "${row.team}", which teams.ts does not know`);
  players.push({ ...row, ...div });
}

if (!players.length) {
  console.error("No players found. Run the roster sync first - the roster files are empty.");
  process.exit(1);
}

const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined ? "null" : String(v));

const values = players
  .map(
    (p) =>
      `  (${q(p.espnId)}, ${q(p.name)}, ${q(p.team)}, ${q(p.position)}, ${q(p.conference)}, ` +
      `${q(p.division)}, ${p.answerable}, ${p.guessable}, ${n(p.heightIn)}, ${n(p.weightLb)}, ${n(p.age)}, ${n(p.jersey)}, ${q(p.college)})`
  )
  .join(",\n");

const sql = `-- Generated by scripts/gen-puzzle-seed.mjs - do not edit by hand.
--
-- The daily puzzle's pool, as Postgres sees it. ${players.length} players.
-- Regenerate and re-run this after every roster sync; see the script for
-- what goes wrong when the two copies drift.
--
-- Rows are never deleted, only re-flagged. Everything the sync has ever
-- seen keeps its place in the table - hard mode will want it back, and a
-- delete would break the foreign key from any daily_puzzles row that
-- already used that player.
--
-- So the pool is DECLARED rather than added to: every row is switched off
-- first and the ${players.length} below switch themselves back on. Without that, a
-- player who drops out of the pool keeps whatever flags they had the last
-- time they were in it.
update public.puzzle_players set answerable = false, guessable = false;

insert into public.puzzle_players
  (espn_id, name, team, position, conference, division, answerable, guessable, height_in, weight_lb, age, jersey, college)
values
${values}
on conflict (espn_id) do update set
  name = excluded.name,
  team = excluded.team,
  position = excluded.position,
  conference = excluded.conference,
  division = excluded.division,
  answerable = excluded.answerable,
  guessable = excluded.guessable,
  height_in = excluded.height_in,
  weight_lb = excluded.weight_lb,
  age = excluded.age,
  jersey = excluded.jersey,
  college = excluded.college;

-- Slots are the running order the daily pick walks, one a day, so only
-- players who can be the answer get one.
--
-- DEALT FRESH every time rather than appended to. The seed used to keep
-- existing slots so days already scheduled would not move, which is right
-- when a weekly sync changes a handful of players - and wrong here,
-- because the pool itself changed shape. Slots left over from a pool of
-- 1,441 are scattered across 1..1441 while ensure_daily_puzzle now walks
-- 1..${players.length}: most days would find no row at their slot and fall through to
-- the same few players over and over.
--
-- Safe to re-deal because ensure_daily_puzzle returns the daily_puzzles
-- row for a date when one exists and only picks a slot when it does not -
-- so this can only change days nobody has played yet.
--
-- Two statements because slot is \`integer unique\`, and one UPDATE that
-- permutes the values trips the constraint on the way through even though
-- the end state is fine.
update public.puzzle_players set slot = null where slot is not null;

update public.puzzle_players
   set slot = sub.next_slot
  from (
    select espn_id, row_number() over (order by random()) as next_slot
      from public.puzzle_players
     where answerable
  ) sub
 where public.puzzle_players.espn_id = sub.espn_id;

-- Expect ${players.length} / ${players.length}, with every other row kept but switched off.
select count(*) filter (where slot is not null) as in_rotation,
       count(*) filter (where guessable)        as guessable,
       count(*)                                 as rows_kept
  from public.puzzle_players;
`;

const out = join(ROOT, "supabase/seeds/puzzle_players.sql");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, sql);

// The college -> conference map, which is what lets a COLLEGE cell come
// back yellow. Read out of src/data/collegeConferences.ts rather than
// restated, for the same reason as everything else here: two copies of a
// fact are two things to get wrong.
function readCollegeConferences() {
  const src = readFileSync(join(ROOT, "src/data/collegeConferences.ts"), "utf8");
  const body = src.slice(src.indexOf("const BY_CONFERENCE"), src.indexOf("export const COLLEGE_CONFERENCES"));
  const re = /"([^"]+)":\s*\[([^\]]*)\]|(\b[A-Za-z][A-Za-z0-9]*):\s*\[([^\]]*)\]/g;
  const map = new Map();
  let hit;
  while ((hit = re.exec(body))) {
    const conference = hit[1] ?? hit[3];
    for (const quoted of (hit[2] ?? hit[4]).match(/"(?:[^"\\]|\\.)*"/g) ?? []) {
      const college = quoted.slice(1, -1);
      if (map.has(college)) {
        throw new Error(`${college} is listed under both ${map.get(college)} and ${conference}`);
      }
      map.set(college, conference);
    }
  }
  if (map.size < 100) throw new Error(`only parsed ${map.size} colleges - the file's shape must have changed`);
  return map;
}

const colleges = readCollegeConferences();
const collegeSql = `-- Generated by scripts/gen-puzzle-seed.mjs - do not edit by hand.
--
-- ${colleges.size} colleges across ${new Set(colleges.values()).size} conferences. See
-- src/data/collegeConferences.ts for the reasoning, including why Notre
-- Dame is listed as ACC and why schools appear at their current
-- conference rather than the one they played in.
--
-- Replace rather than upsert: unlike puzzle_players, nothing here
-- carries state. A college that changed conference should CHANGE, and a
-- school dropped from the map should disappear rather than linger and
-- keep painting a stale yellow.

delete from public.college_conferences;

insert into public.college_conferences (college, conference)
values
${[...colleges].sort((a, b) => a[0].localeCompare(b[0])).map(([c, k]) => `  (${q(c)}, ${q(k)})`).join(",\n")};
`;
const collegeOut = join(ROOT, "supabase/seeds/college_conferences.sql");
writeFileSync(collegeOut, collegeSql);

// A roster college with no conference can never go yellow. That is fine
// for Division II and Canadian schools and NOT fine for, say, a new FBS
// program, so the ones that cover real numbers of players get named.
const missing = new Map();
for (const p of players) {
  if (p.college && !colleges.has(p.college)) missing.set(p.college, (missing.get(p.college) ?? 0) + 1);
}
const withCollege = players.filter((p) => p.college).length;
const mapped = players.filter((p) => p.college && colleges.has(p.college)).length;

const withExtras = players.filter((p) => p.heightIn || p.weightLb || p.age || p.jersey).length;
console.log(`Wrote ${out}`);
console.log(`  ${players.length} players across ${new Set(players.map((p) => p.team)).size} teams`);
console.log(`  QB/RB/TE starters + WR1 and WR2, from the position files`);
{
  const byPos = new Map();
  for (const p of players) byPos.set(p.position, (byPos.get(p.position) ?? 0) + 1);
  console.log(`  by position: ${[...byPos].sort().map(([k, v]) => `${k} ${v}`).join(", ")}`);
}

// EVERY team has to turn up at EVERY classic position. A team missing
// from the pool is not a smaller pool, it is a hole: nobody can guess
// Jalen Hurts, and the day the answer is an Eagle nobody can solve it.
// This has caught a real one - a depth-rank filter over the full roster
// left three teams with no skill players at all, which is why the pool
// is built from the position files instead.
{
  const teams = [...new Set(players.map((p) => p.team))].sort();
  const holes = [];
  for (const [, position] of CLASSIC_FILES) {
    const missing = teams.filter((t) => !players.some((p) => p.team === t && p.position === position));
    if (missing.length) holes.push(`${position}: ${missing.join(", ")}`);
  }
  if (teams.length !== 32) holes.push(`only ${teams.length} teams in the pool`);
  if (holes.length) {
    console.error(`\n  TEAMS MISSING FROM THE POOL - the seed was NOT written:`);
    for (const h of holes) console.error(`    ${h}`);
    console.error(`  Re-run scripts/sync-players.mjs; the position files should hold all 32.`);
    process.exit(1);
  }
}

// A pick with NO depth-chart rank was never chosen by a depth chart. When
// ESPN publishes no ranks for a team at a position, syncPosition tops the
// list up from ROSTER ORDER - which it warns about and which is roughly
// jersey number, so it has nothing to do with who starts. That is how
// Philadelphia's starting quarterback came out as Andy Dalton.
//
// Absent is better than confidently wrong, and both are worse than
// stopping: a puzzle whose answer is "the Eagles' starting QB" and whose
// answer is Andy Dalton is unsolvable and looks broken. all.ts carries
// the rank, so a pick missing one is exactly a pick that was guessed.
{
  const guessed = players.filter((p) => full.get(p.espnId)?.depthRank == null);
  if (guessed.length) {
    const byTeam = new Map();
    for (const p of guessed) {
      const key = `${p.team} ${p.position}`;
      byTeam.set(key, [...(byTeam.get(key) ?? []), p.name]);
    }
    console.error(`\n  ${guessed.length} PICKS WERE NOT MADE BY A DEPTH CHART - the seed was NOT written:`);
    for (const [key, names] of [...byTeam].sort()) console.error(`    ${key}: ${names.join(", ")}`);
    console.error(`  ESPN published no ranks for these, so the sync filled them from roster`);
    console.error(`  order. Re-run scripts/sync-players.mjs; if they are still unranked, these`);
    console.error(`  teams need naming by hand before classic mode can ship.`);
    process.exit(1);
  }
}
console.log(`Wrote ${collegeOut}`);
console.log(`  ${colleges.size} colleges in ${new Set(colleges.values()).size} conferences`);
console.log(`  ${mapped}/${withCollege} players (${((mapped / withCollege) * 100).toFixed(1)}%) can match a college by conference`);
// Sorted by how many players it costs, because one unmapped school with
// forty players matters and thirty with one each do not.
const notable = [...missing].sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 5);
if (notable.length) {
  console.log(`  no conference for: ${notable.map(([c, n]) => `${c} (${n})`).join(", ")}`);
  console.log(`  -> add them to src/data/collegeConferences.ts if they belong to one`);
}
if (!withExtras) {
  console.log("  (none yet - re-run scripts/sync-players.mjs to capture those, then run this again)");
}
