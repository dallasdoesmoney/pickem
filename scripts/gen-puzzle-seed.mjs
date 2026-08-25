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
function readAnswerMaxDepthRank() {
  const src = readFileSync(join(ROOT, "src/data/puzzlePlayers.ts"), "utf8");
  const hit = src.match(/export const ANSWER_MAX_DEPTH_RANK = (\d+);/);
  if (!hit) throw new Error("ANSWER_MAX_DEPTH_RANK not found in src/data/puzzlePlayers.ts");
  return Number(hit[1]);
}

function readAllPlayers(maxRank) {
  const src = readFileSync(join(ROOT, "src/data/rosters/all.ts"), "utf8");
  const re = /\{ espnId: "([^"]+)", name: "([^"]+)", team: "([A-Z]{2,3})", position: "([^"]*)"([^}]*)\}/g;
  const rows = [];
  let m;
  while ((m = re.exec(src))) {
    const extras = extrasFrom(m[5] ?? "");
    rows.push({
      espnId: m[1],
      name: m[2],
      team: m[3],
      position: m[4],
      answerable: extras.depthRank !== null && extras.depthRank <= maxRank,
      ...extras,
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

const maxRank = readAnswerMaxDepthRank();
const full = readAllPlayers(maxRank);
// Everyone in the five position files is a depth-chart pick by
// construction, so the fallback pool is entirely answerable.
const source = full.length
  ? full
  : FILES.flatMap(([file, position]) => readRoster(file).map((r) => ({ ...r, position, answerable: true })));

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
      `${q(p.division)}, ${p.answerable}, ${n(p.heightIn)}, ${n(p.weightLb)}, ${n(p.age)}, ${n(p.jersey)}, ${q(p.college)})`
  )
  .join(",\n");

const sql = `-- Generated by scripts/gen-puzzle-seed.mjs - do not edit by hand.
--
-- The daily puzzle's pool, as Postgres sees it. ${players.length} players.
-- Regenerate and re-run this after every roster sync; see the script for
-- what goes wrong when the two copies drift.
--
-- Upsert rather than replace: puzzle_players.slot carries the shuffled
-- running order the daily pick indexes into, and wiping the table would
-- reshuffle it and change which player is "today" mid-season. New
-- players get a slot on the end; departed ones are left in place rather
-- than deleted, so an answer already used stays resolvable.

insert into public.puzzle_players
  (espn_id, name, team, position, conference, division, answerable, height_in, weight_lb, age, jersey, college)
values
${values}
on conflict (espn_id) do update set
  name = excluded.name,
  team = excluded.team,
  position = excluded.position,
  conference = excluded.conference,
  division = excluded.division,
  answerable = excluded.answerable,
  height_in = excluded.height_in,
  weight_lb = excluded.weight_lb,
  age = excluded.age,
  jersey = excluded.jersey,
  college = excluded.college;

-- Slots are the running order the daily pick walks, so ONLY answerable
-- players get one - that is what keeps a third-string guard guessable but
-- never the answer. Random so the order is not alphabetical, and only for
-- rows that arrived without one, so existing slots - and therefore the
-- puzzles already scheduled - never move.
update public.puzzle_players
   set slot = sub.next_slot
  from (
    select espn_id,
           coalesce((select max(slot) from public.puzzle_players), 0)
             + row_number() over (order by random()) as next_slot
      from public.puzzle_players
     where slot is null and answerable
  ) sub
 where public.puzzle_players.espn_id = sub.espn_id
   and public.puzzle_players.slot is null;

-- A player who dropped off the depth chart keeps their slot rather than
-- losing it: removing one would leave a gap that shifts every later day.
-- ensure_daily_puzzle steps over gaps, but the answer for a given date
-- would still change, which is not something to do mid-season.
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
const answerable = players.filter((p) => p.answerable).length;
console.log(`Wrote ${out}`);
console.log(`  ${players.length} players across ${new Set(players.map((p) => p.team)).size} teams`);
console.log(`  ${answerable} can be the answer (depth rank <= ${maxRank}), ${players.length - answerable} are guess-only`);
// The bug this guard exists for marked 2,985 of 3,021 answerable, which
// is the roster wearing a different name.
if (full.length && answerable > players.length * 0.6) {
  console.error(`\n  ${answerable} of ${players.length} answerable - that is not a starter list. Check depthRank in all.ts.`);
  process.exit(1);
}
console.log(`  ${withExtras} carry height/weight/age/jersey`);
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
if (!full.length) console.log("  (from the five position files - run scripts/sync-players.mjs for every roster)");
if (!withExtras) {
  console.log("  (none yet - re-run scripts/sync-players.mjs to capture those, then run this again)");
}
