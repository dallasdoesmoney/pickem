// Posts final scores to game_results, so nobody has to type them in.
//
// Reads the schedule out of src/data/games.ts, asks ESPN for each week
// that has already kicked off, and upserts a winner for every game that
// has actually finished. Everything else - a game in progress, a week
// that has not started, a tie - is left alone rather than guessed at.
//
// It writes through the sync_game_results RPC rather than with a service
// role key: see supabase/migrations/0039_results_sync.sql for why.
//
// Nothing here publishes anything. weeks.results_published still gates
// every scoring view and is still a person's decision.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

// ESPN's team abbreviations differ from ours in one place, the same way
// they do for the logos in teams.ts and the rosters in sync-players.mjs.
const ESPN_TO_OURS = { WSH: "WAS" };
const ours = (abbr) => ESPN_TO_OURS[abbr] ?? abbr;

// The schedule, read out of the TypeScript rather than imported from it -
// this is a plain node script and games.ts is a module with path aliases.
//
// Parsed strictly and checked afterwards: a regex that silently matches
// nothing would make this script cheerfully report "0 games to post"
// forever, which is the failure mode that looks exactly like success.
//
// kickoff comes along too, because the deadline reminder needs to know
// when a week actually locks and there should not be a second regex
// reading the same file to find out. It is captured optionally: a game
// without one still parses rather than vanishing from the list, which
// would turn a schedule typo into a silently short week.
export function parseGames(source) {
  const games = [];
  const re =
    /\{\s*id:\s*"([^"]+)",\s*week:\s*(\d+),\s*away:\s*"([A-Z]+)",\s*home:\s*"([A-Z]+)"(?:,\s*kickoff:\s*"([^"]+)")?/g;
  let m;
  while ((m = re.exec(source))) {
    games.push({ id: m[1], week: Number(m[2]), away: m[3], home: m[4], kickoff: m[5] ?? null });
  }
  return games;
}

// Which of our games a finished ESPN event is, and who won it.
//
// Matched on week plus both teams, NOT on any id. Our ids mostly read
// away-home, but not always - the neutral-site game in week 1 is keyed on
// the designated home team - so deriving one would quietly mis-post
// exactly the game whose result is most confusing to get wrong.
export function resultsFrom(events, games, week) {
  const byMatchup = new Map();
  for (const g of games) {
    if (g.week === week) byMatchup.set(`${g.home}:${g.away}`, g);
  }

  const rows = [];
  const skipped = [];
  for (const event of events ?? []) {
    const comp = event.competitions?.[0];
    if (!comp) continue;

    const status = comp.status?.type ?? event.status?.type ?? {};
    if (!status.completed) {
      skipped.push({ event: event.shortName ?? event.id, why: status.description ?? "not final" });
      continue;
    }

    const sides = comp.competitors ?? [];
    const home = sides.find((c) => c.homeAway === "home");
    const away = sides.find((c) => c.homeAway === "away");
    if (!home || !away) continue;

    const homeAbbr = ours(home.team?.abbreviation ?? "");
    const awayAbbr = ours(away.team?.abbreviation ?? "");
    const game = byMatchup.get(`${homeAbbr}:${awayAbbr}`);
    if (!game) {
      skipped.push({ event: `${awayAbbr} at ${homeAbbr}`, why: "not in our schedule for this week" });
      continue;
    }

    // A tie is a real outcome and game_results.winner cannot express it -
    // the column is one team's abbreviation. Posting either side would be
    // a wrong result that scores picks incorrectly and looks deliberate,
    // so the game stays unrecorded and says so loudly.
    const winner = sides.find((c) => c.winner === true);
    if (!winner) {
      skipped.push({ event: `${awayAbbr} at ${homeAbbr}`, why: "TIE - cannot be recorded, enter it by hand" });
      continue;
    }

    rows.push({ game_id: game.id, week, winner: ours(winner.team?.abbreviation ?? "") });
  }
  return { rows, skipped };
}

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

async function main() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, RESULTS_SYNC_TOKEN } = process.env;
  const missing = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "RESULTS_SYNC_TOKEN"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    // See send-weekly-deadline.mjs for why this says more than the list:
    // a secret under a slightly different name is invisible from here,
    // and this job failed that way from the day it was written.
    console.error(`Missing: ${missing.join(", ")}`);
    console.error(
      "\nThese come from GitHub Actions secrets (the Supabase pair also accepts a\n" +
        "NEXT_PUBLIC_ prefix). Empty means no secret exists under the name the\n" +
        "workflow asks for - check Settings > Secrets and variables > Actions.",
    );
    process.exit(1);
  }

  const source = readFileSync(join(ROOT, "src", "data", "games.ts"), "utf8");
  const games = parseGames(source);
  if (games.length < 200) {
    throw new Error(
      `Only parsed ${games.length} games out of src/data/games.ts - a full season is 272. ` +
        `The file's shape has probably changed; fix parseGames rather than posting a partial week.`,
    );
  }

  // The season is on the front of every game id, so it does not need to
  // be configured anywhere and cannot drift from the schedule.
  const season = games[0].id.slice(0, 4);
  const weeks = [...new Set(games.map((g) => g.week))].sort((a, b) => a - b);

  const rows = [];
  const notes = [];
  for (const week of weeks) {
    let events;
    try {
      const data = await json(`${SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`);
      events = data.events;
    } catch (err) {
      // One bad week should not lose the other seventeen.
      notes.push(`week ${week}: ${err.message}`);
      continue;
    }
    const { rows: got, skipped } = resultsFrom(events, games, week);
    rows.push(...got);
    for (const s of skipped) {
      if (s.why.startsWith("TIE") || s.why.startsWith("not in our")) {
        notes.push(`week ${week}: ${s.event} - ${s.why}`);
      }
    }
  }

  if (notes.length) {
    console.log("Needs a look:");
    for (const n of notes) console.log(`  ${n}`);
  }

  if (!rows.length) {
    console.log("No finished games to post.");
    return;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sync_game_results`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_token: RESULTS_SYNC_TOKEN, p_rows: rows }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Supabase said ${res.status}: ${body}`);

  console.log(`${rows.length} finished games posted, ${body.trim()} changed.`);
  // Loud when it matters, quiet when it does not: a run that changes
  // nothing is the normal case and should not read like an event.
  if (Number(body) > 0) {
    console.log("Results are in the table but NOT published - publish the week in the admin panel.");
  }
}

// Importable for the test without running.
if (process.argv[1] && process.argv[1].endsWith("sync-results.mjs")) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
