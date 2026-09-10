// Picks lock at kickoff - the rule, and the two copies of the schedule
// that have to agree about it.
//
// The bug this covers is not subtle and it is not theoretical: week 1's
// Wednesday night game kicked off at 8:20 ET and picks on it stayed
// editable, because the only thing that had ever closed picking was an
// admin flipping weeks.is_open by hand.
//
// There are two enforcement points now, the browser and RLS, and they
// read the kickoff times from two different places - src/data/games.ts
// and public.game_kickoffs. The interesting failure is not "does the
// comparison work", it is "do those two places still say the same thing".
// So most of what is below is about the seam between them.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generate, parseGames, buildSql, OUT } from "./gen-kickoff-migration.mjs";
import { isKickedOff, openGameIds } from "../src/lib/lockAtKickoff.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(56)} ${detail}`);
  if (!cond) failed++;
}

const KICK = Date.parse("2026-09-09T20:20:00-04:00");
const game = (over = {}) => ({ id: "g", week: 1, away: "NE", home: "SEA", kickoff: "2026-09-09T20:20:00-04:00", network: "NBC", ...over });

// --- the boundary -----------------------------------------------------
// Kickoff itself is closed, not open. A pick made "at 8:20" is a pick
// made after the ball is in the air.
ok("one ms before kickoff is open", isKickedOff(game(), KICK - 1) === false);
ok("kickoff exactly is locked", isKickedOff(game(), KICK) === true);
ok("one ms after kickoff is locked", isKickedOff(game(), KICK + 1) === true);
ok("the real week-1 opener is locked today", isKickedOff(game(), Date.now()) === true, "8:20 ET Wed");

// Fail shut. A malformed date costs us one unpickable game, not one
// permanently editable one.
ok("unparseable kickoff locks", isKickedOff(game({ kickoff: "next tuesday" }), KICK - 999999) === true);
ok("empty kickoff locks", isKickedOff(game({ kickoff: "" }), 0) === true);

// --- per game, not per week -------------------------------------------
// The whole reason this is per game: the week-1 opener starting must not
// take the Sunday slate with it.
const week1 = [
  game({ id: "wed", kickoff: "2026-09-09T20:20:00-04:00" }),
  game({ id: "thu", kickoff: "2026-09-10T20:35:00-04:00" }),
  game({ id: "sun", kickoff: "2026-09-13T13:00:00-04:00" }),
];
const afterWed = Date.parse("2026-09-09T23:00:00-04:00");
const open = openGameIds(week1, afterWed);
ok("started game drops out", open.has("wed") === false);
ok("later games stay open", open.has("thu") && open.has("sun"), `${open.size} open`);
ok("openGameIds returns a Set", open instanceof Set);
ok("everything open before the week starts", openGameIds(week1, KICK - 1).size === 3);
ok("nothing open after the last one", openGameIds(week1, Date.parse("2026-09-14T00:00:00-04:00")).size === 0);

// --- the schedule itself ----------------------------------------------
const source = readFileSync(join(ROOT, "src", "data", "games.ts"), "utf8");
const games = parseGames(source);
ok("parsed a full season", games.length === 272, `${games.length} games`);

const unparseable = games.filter((g) => !Number.isFinite(Date.parse(g.kickoff)));
ok("every kickoff parses", unparseable.length === 0, unparseable.map((g) => g.id).join(", "));

const noOffset = games.filter((g) => !/[+-]\d{2}:\d{2}$|Z$/.test(g.kickoff));
// A kickoff without an offset is read in the *server's* zone by Postgres
// and the *browser's* zone by JS, so the two enforcement points would
// disagree by hours - and in the direction that unlocks, for anybody west
// of the server.
ok("every kickoff carries a UTC offset", noOffset.length === 0, noOffset.map((g) => g.id).join(", "));

// --- the generated migration ------------------------------------------
const sql = generate();
const onDisk = readFileSync(OUT, "utf8");
ok("committed migration is current", onDisk === sql, "run: node scripts/gen-kickoff-migration.mjs");

// The two copies of the schedule must name the same games. A row missing
// from the table is a game nobody can pick (fail shut) - loud, but still
// worth catching here rather than on a Sunday.
const inSql = [...sql.matchAll(/^ {2}\('([^']+)', (\d+), '([^']+)'::timestamptz\),?$/gm)].map((m) => ({
  id: m[1],
  week: Number(m[2]),
  kickoff: m[3],
}));
ok("migration has one row per game", inSql.length === games.length, `${inSql.length} rows`);
const mismatched = games.filter((g, i) => inSql[i]?.id !== g.id || inSql[i]?.week !== g.week || inSql[i]?.kickoff !== g.kickoff);
ok("every row matches games.ts exactly", mismatched.length === 0, mismatched.slice(0, 3).map((g) => g.id).join(", "));
ok("game ids are unique", new Set(inSql.map((r) => r.id)).size === inSql.length);

// --- the policy is fail-shut ------------------------------------------
// Written as "there IS a row and it is in the future". The inverted form
// ("no row says it started") reads almost identically and silently makes
// an unknown game_id editable forever, which is the original bug wearing
// a new hat.
// Comments stripped first: this file explains the inverted form at
// length, and a check that reads prose is not checking the policy.
const code = sql.replace(/^\s*--.*$/gm, "");
const body = code.match(/create or replace function public\.game_is_open[\s\S]*?as \$\$([\s\S]*?)\$\$;/)?.[1] ?? "";
ok("game_is_open requires a row", /select exists\s*\(\s*select 1 from public\.game_kickoffs k\s*where k\.game_id = p_game_id and k\.kickoff > now\(\)/.test(body));
// `not exists (... kickoff <= now())` reads almost identically and is the
// inverted, fail-OPEN form: it would leave a game_id the table has never
// heard of editable forever, which is the original bug wearing a new hat.
ok("game_is_open is not the inverted form", !/not exists/.test(body) && !/<=\s*now\(\)/.test(body), body.trim().replace(/\s+/g, " "));
for (const op of ["insert", "update", "delete"]) {
  ok(`weekly_picks ${op} policy checks the game`, new RegExp(`weekly_picks_${op}_own[\\s\\S]{0,400}?public\\.game_is_open\\(weekly_picks\\.game_id\\)`).test(sql));
  ok(`weekly_picks ${op} policy still checks the week`, new RegExp(`weekly_picks_${op}_own[\\s\\S]{0,400}?w\\.is_open = true`).test(sql));
}
ok("game_kickoffs is not user-writable", /game_kickoffs_(insert|update|delete)_admin[\s\S]{0,120}public\.is_admin\(\)/.test(sql));
ok("game_kickoffs has RLS on", /alter table public\.game_kickoffs enable row level security/.test(sql));
ok("the seed re-runs cleanly", /on conflict \(game_id\) do update/.test(sql));

// The generator must refuse to emit a migration it built from a schedule
// it could not read - a silently empty parse would produce a table with
// no rows, and fail-shut would then lock the entire season.
let refused = false;
try {
  buildSql(parseGames("export const WEEK_1_GAMES = [];"));
  // buildSql itself does not guard; generate() does. Prove the guard is
  // in the path that writes the file.
} catch {
  refused = true;
}
const genSource = readFileSync(join(ROOT, "scripts", "gen-kickoff-migration.mjs"), "utf8");
ok("generator guards a drifted parser", /games\.length < 200/.test(genSource), refused ? "" : "via generate()");

// --- the client save path ---------------------------------------------
// A whole-week delete-then-insert cannot survive a per-game lock: the
// database refuses to delete the started game's row, the row survives,
// and the re-insert collides with it on (user_id, week, game_id). The
// delete has to be scoped to the same set being inserted.
const picksSource = readFileSync(join(ROOT, "src", "lib", "supabase", "picks.ts"), "utf8");
const save = picksSource.slice(picksSource.indexOf("export async function saveWeeklyPicks"), picksSource.indexOf("export async function fetchSeasonPicks"));
// Only ever deletes games the board no longer has a pick for, and only
// after the writes have landed. The delete-everything-then-put-it-back
// shape is what emptied boards twice in one day; if it comes back, so
// does that.
ok("save deletes only un-picked games", /\.delete\(\)[\s\S]{0,220}\.in\("game_id", unpicked\)/.test(save));
ok("un-picked means exactly that", /const unpicked = open\.filter\(\(gameId\) => !picks\[gameId\]\);/.test(save));
ok("save writes with an upsert", /\.upsert\(rows, \{ onConflict: "user_id,week,game_id" \}\)/.test(save));
ok("save only writes open games", /\.filter\(\(\[gameId\]\) => openGameIds\.has\(gameId\)\)/.test(save));
ok("save no-ops when nothing is open", /if \(open\.length === 0\) return;/.test(save));
ok("the lock is released before it is reclaimed", save.indexOf("is_lock: false") < save.indexOf(".upsert("));
ok("writes happen before the delete", save.indexOf(".upsert(") < save.indexOf(".delete()"));
ok("no unscoped week-wide delete", !/\.delete\(\)[\s\S]{0,200}\.eq\("week", week\)\s*;/.test(save));

// Every caller passes the set - a missed one would be a TypeScript error,
// but the point is that none of them fell back to a whole-week wipe.
for (const file of ["src/app/weekly/page.tsx", "src/lib/supabase/migration.ts"]) {
  const text = readFileSync(join(ROOT, file), "utf8");
  const calls = [...text.matchAll(/saveWeeklyPicks\(([^;]*?)\)[\s;.]/g)].filter((m) => !m[1].includes("import"));
  // The set is the LAST argument, so that is where to look - matching it
  // anywhere in the call would pass on a stray `open` in an earlier one.
  const scoped = calls.every((m) => /(openIdsNow\(\)|open)$/.test(m[1].trim()));
  ok(`${file} scopes every save`, calls.length > 0 && scoped, `${calls.length} call sites`);
}

console.log(failed === 0 ? "\nall lock-at-kickoff checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
