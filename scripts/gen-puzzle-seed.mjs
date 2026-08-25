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
if (!full.length) console.log("  (from the five position files - run scripts/sync-players.mjs for every roster)");
if (!withExtras) {
  console.log("  (none yet - re-run scripts/sync-players.mjs to capture those, then run this again)");
}
