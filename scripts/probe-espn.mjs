// WHAT ESPN ACTUALLY RETURNS, printed and nothing else.
//
// This writes nothing, anywhere. It exists because the next job -
// filling in records and betting lines automatically - has to parse a
// response shape, and getting that shape wrong is not a crash. It is a
// wrong point spread on a live board, which looks deliberate and which
// nobody would think to question.
//
// The sandbox this was written in cannot reach site.api.espn.com at all
// (the egress proxy denies it), so the alternative was a parser written
// against a remembered schema. Run this once from Actions, where the
// network works, and the writer gets built against real output instead.
//
//   node scripts/probe-espn.mjs          # the open week, or WEEK=2
//
// Delete it once the sync it informs is written and trusted.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseGames } from "./sync-results.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const ESPN_TO_OURS = { WSH: "WAS" };
const ours = (a) => ESPN_TO_OURS[a] ?? a;

const WEEK = Number(process.env.WEEK ?? 2);
const games = parseGames(readFileSync(join(ROOT, "src", "data", "games.ts"), "utf8"));
const mine = games.filter((g) => g.week === WEEK);
if (mine.length === 0) {
  console.error(`No games in src/data/games.ts for week ${WEEK}.`);
  process.exit(1);
}
const season = games[0].id.slice(0, 4);

const url = `${SCOREBOARD}?dates=${season}&seasontype=2&week=${WEEK}`;
console.log(`GET ${url}\n`);
const res = await fetch(url);
if (!res.ok) {
  console.error(`${res.status} ${res.statusText}`);
  process.exit(1);
}
const data = await res.json();
const events = data.events ?? [];
console.log(`${events.length} events back, ${mine.length} games in our week ${WEEK}\n`);

// Print the WHOLE odds and records objects for the first game rather than
// the fields I expect to be there. The point of this run is to find out
// what is actually in them, and a probe that only prints what it already
// assumes teaches nothing.
const first = events[0]?.competitions?.[0];
if (first) {
  console.log("=".repeat(70));
  console.log("FIRST GAME, VERBATIM - this is what the parser gets written against");
  console.log("=".repeat(70));
  console.log("\ncompetitions[0].odds:");
  console.log(JSON.stringify(first.odds ?? null, null, 2));
  console.log("\ncompetitors[0] (home or away) records + a few fields:");
  const c0 = first.competitors?.[0] ?? {};
  console.log(JSON.stringify({ homeAway: c0.homeAway, team: { abbreviation: c0.team?.abbreviation }, records: c0.records ?? null, score: c0.score }, null, 2));
  console.log("\ncompetitions[0].date / status:");
  console.log(JSON.stringify({ date: first.date, status: first.status?.type?.name }, null, 2));
}

// Then a compact line per game, which is what the writer will need to
// produce. Every value is printed as "not present" rather than skipped,
// so a field that is missing for SOME games shows up as a gap instead of
// being invisible.
console.log("\n" + "=".repeat(70));
console.log("EVERY GAME, SUMMARISED");
console.log("=".repeat(70) + "\n");
const show = (v) => (v === undefined || v === null || v === "" ? "—" : String(v));
const byMatchup = new Map(mine.map((g) => [`${g.home}:${g.away}`, g]));
let matched = 0;
for (const ev of events) {
  const comp = ev.competitions?.[0];
  if (!comp) continue;
  const sides = comp.competitors ?? [];
  const home = sides.find((c) => c.homeAway === "home");
  const away = sides.find((c) => c.homeAway === "away");
  const h = ours(home?.team?.abbreviation ?? "");
  const a = ours(away?.team?.abbreviation ?? "");
  const mineGame = byMatchup.get(`${h}:${a}`);
  if (mineGame) matched++;

  const rec = (c) => (c?.records ?? []).map((r) => `${r.type ?? r.name}=${r.summary}`).join(" ") || "—";
  const odds = comp.odds?.[0] ?? null;
  console.log(`${a} at ${h}   ${mineGame ? mineGame.id : "*** NOT IN OUR SCHEDULE ***"}`);
  console.log(`   kickoff   espn ${show(comp.date)}   ours ${show(mineGame?.kickoff)}`);
  console.log(`   records   away ${rec(away)}   home ${rec(home)}`);
  console.log(
    `   odds      details ${show(odds?.details)}   spread ${show(odds?.spread)}   ` +
      `homeFav ${show(odds?.homeTeamOdds?.favorite)}   awayFav ${show(odds?.awayTeamOdds?.favorite)}   ` +
      `provider ${show(odds?.provider?.name)}`,
  );
  console.log();
}
console.log(`matched ${matched} of ${mine.length} of our week ${WEEK} games by home:away.`);
console.log("\nNOTHING WAS WRITTEN. This run only reports.");
