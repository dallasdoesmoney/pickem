// Runs the scoreboard parsing against stubbed payloads, so a change in
// ESPN's shape fails here rather than by posting a wrong winner.
//
// The same pre-flight sync-players.test.mjs is: ESPN is not reachable
// from CI's test step by design, and a result posted wrong is worse than
// a result not posted at all - it scores everybody's picks against a game
// that did not happen that way.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseGames, resultsFrom } from "./sync-results.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let failures = 0;
function check(what, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    failures++;
    console.error(`FAIL ${what}\n  got  ${JSON.stringify(got)}\n  want ${JSON.stringify(want)}`);
  }
}

// ---- the schedule parses, and matches the real file -------------------
const games = parseGames(readFileSync(join(ROOT, "src", "data", "games.ts"), "utf8"));
if (games.length < 200) {
  failures++;
  console.error(`FAIL parseGames read only ${games.length} games from src/data/games.ts`);
}
// The neutral-site week 1 game, whose id is keyed on the designated home
// team rather than the away-home order the others use. If matching ever
// starts deriving ids instead of using home+away, this is what breaks.
const neutral = games.find((g) => g.id === "2026-w1-lar-sf");
check("neutral-site game reads home LAR / away SF", neutral && [neutral.home, neutral.away], ["LAR", "SF"]);

// ---- scoreboard shapes ------------------------------------------------
const evt = (away, home, { completed = true, winner = null, desc = "Final" } = {}) => ({
  shortName: `${away} @ ${home}`,
  competitions: [
    {
      status: { type: { completed, description: desc } },
      competitors: [
        { homeAway: "home", winner: winner === home, team: { abbreviation: home } },
        { homeAway: "away", winner: winner === away, team: { abbreviation: away } },
      ],
    },
  ],
});

const wk1 = games.filter((g) => g.week === 1);

check(
  "a finished game posts its winner",
  resultsFrom([evt("NE", "SEA", { winner: "SEA" })], wk1, 1).rows,
  [{ game_id: "2026-w1-ne-sea", week: 1, winner: "SEA" }],
);

check(
  "the neutral-site game maps on home+away, not on id order",
  resultsFrom([evt("SF", "LAR", { winner: "SF" })], wk1, 1).rows,
  [{ game_id: "2026-w1-lar-sf", week: 1, winner: "SF" }],
);

check(
  "a game in progress posts nothing",
  resultsFrom([evt("NE", "SEA", { completed: false, desc: "In Progress" })], wk1, 1).rows,
  [],
);

const tie = resultsFrom([evt("NE", "SEA", { winner: null })], wk1, 1);
check("a tie posts nothing", tie.rows, []);
check("a tie says so", tie.skipped.some((s) => s.why.startsWith("TIE")), true);

// ESPN calls Washington WSH; we call them WAS. Both the matchup lookup
// and the winner it writes have to be translated, not just one.
const wsh = games.find((g) => g.week === 1 && (g.home === "WAS" || g.away === "WAS"));
if (wsh) {
  const espnHome = wsh.home === "WAS" ? "WSH" : wsh.home;
  const espnAway = wsh.away === "WAS" ? "WSH" : wsh.away;
  check(
    "WSH is translated to WAS in both the lookup and the winner",
    resultsFrom([evt(espnAway, espnHome, { winner: "WSH" })], wk1, 1).rows,
    [{ game_id: wsh.id, week: 1, winner: "WAS" }],
  );
} else {
  failures++;
  console.error("FAIL no Washington game in week 1 to check the abbreviation mapping against");
}

check(
  "a game we do not have in that week is skipped, not guessed",
  resultsFrom([evt("KC", "BUF", { winner: "KC" })], wk1, 1).rows.length,
  0,
);

check("an empty scoreboard is fine", resultsFrom([], wk1, 1).rows, []);
check("a missing scoreboard is fine", resultsFrom(undefined, wk1, 1).rows, []);

if (failures) {
  console.error(`\n${failures} failed`);
  process.exit(1);
}
console.log("all scoreboard cases pass");
