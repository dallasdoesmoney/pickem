// Writes src/data/{qbs,rbs,wrs}.ts from ESPN's own depth charts.
//
//   node scripts/sync-players.mjs
//
// Exists because the two halves of a quarterback row go stale on
// different schedules and neither fails loudly. Starters change week to
// week. A player id typed in wrong renders a different person's face
// under the right name - which is worse than a broken image, because
// nothing about it looks broken. So neither half is ever written by
// hand: every id in the output comes from the same response as the name
// beside it.
//
// The first version of this read the team roster and took the first
// quarterback in it, on the assumption that ESPN lists them by depth.
// It does not - that run returned Tommy DeVito for New England and Andy
// Dalton for Philadelphia, both backups. Roster order is roughly jersey
// number, which has nothing to do with who starts. So this asks the
// depth chart endpoint, which ranks them, and only falls back to roster
// order when a team has no published chart - shouting about it when it
// does, because a silent fallback here is how the wrong 32 faces ship.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, join } from "node:path";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data");

// One entry per category. `slots` decides which depth chart positions
// count, and `perTeam` how many players to take from them.
//
// Quarterback and running back are one apiece because both positions
// have a real starter. Wide receiver does not - a team lines up three,
// and ESPN splits them across separate left/right/slot entries that each
// rank their own occupant first. So there is no "the WR2" to read off a
// chart; there are three rank-1 receivers and an ordering between the
// slots. Taking two gives the two the chart lists soonest, which is the
// closest thing to "the guys who start outside" that the data supports.
const POSITIONS = [
  {
    file: "qbs.ts",
    typeName: "Quarterback",
    exportName: "QUARTERBACKS",
    noun: "quarterback",
    slots: (abbr) => abbr === "QB",
    perTeam: 1,
  },
  {
    file: "rbs.ts",
    typeName: "RunningBack",
    exportName: "RUNNING_BACKS",
    noun: "running back",
    // ESPN has used both over the years, depending on the formation.
    slots: (abbr) => abbr === "RB" || abbr === "HB",
    perTeam: 1,
  },
  {
    file: "wrs.ts",
    typeName: "WideReceiver",
    exportName: "WIDE_RECEIVERS",
    noun: "wide receiver",
    // LWR / RWR / SWR, and plain WR in some formations.
    slots: (abbr) => abbr.endsWith("WR"),
    perTeam: 2,
  },
];
const CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl";
const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

// ESPN's team abbreviations differ from ours in one place, the same way
// they do for the logos in teams.ts.
const ESPN_TO_OURS = { WSH: "WAS" };

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

// Everyone on the roster at a position, in the order ESPN returns them.
// Used as the fallback, and as the "behind:" column that makes a wrong
// pick obvious in the pull request rather than on the site.
async function rosterAt(teamId, matches) {
  const roster = await json(`${SITE}/teams/${teamId}/roster`);
  return (roster.athletes ?? [])
    .flatMap((g) => g.items ?? g.athletes ?? [g])
    .filter(Boolean)
    .filter((a) => matches(String(a.position?.abbreviation ?? a.position?.name ?? "").toUpperCase()))
    .map((a) => ({ espnId: String(a.id), name: a.fullName ?? a.displayName }));
}

// The players the depth chart ranks highest at a position, deduped.
// Returns [] rather than throwing so a team with no published chart
// falls through to the roster.
async function depthChartAt(season, teamId, matches, count) {
  let charts;
  try {
    charts = await json(`${CORE}/seasons/${season}/teams/${teamId}/depthcharts`);
  } catch {
    return [];
  }
  const ranked = [];
  for (const item of charts.items ?? []) {
    // Formation-keyed, and the key's case has moved around over the
    // years, so match on the position rather than trusting the key.
    let slotIndex = 0;
    for (const slot of Object.values(item.positions ?? {})) {
      const abbr = String(slot.position?.abbreviation ?? slot.position?.name ?? "").toUpperCase();
      slotIndex += 1;
      if (!matches(abbr)) continue;
      for (const entry of slot.athletes ?? []) {
        if (typeof entry.rank === "number" && entry.athlete?.$ref) {
          ranked.push({ rank: entry.rank, slotIndex, ref: entry.athlete.$ref });
        }
      }
    }
  }
  if (!ranked.length) return [];
  // Rank first, then the order the chart lists the slots. Across three
  // receiver slots that means the starters come before any backup, and
  // ties fall back to the chart's own ordering rather than to whatever
  // order the JSON happened to arrive in.
  ranked.sort((a, b) => a.rank - b.rank || a.slotIndex - b.slotIndex);

  const out = [];
  const seen = new Set();
  for (const entry of ranked) {
    if (out.length >= count) break;
    // $ref comes back http:// on some responses, which redirects.
    const athlete = await json(entry.ref.replace(/^http:/, "https:"));
    const espnId = String(athlete.id);
    // A player can occupy more than one slot or formation.
    if (seen.has(espnId)) continue;
    seen.add(espnId);
    out.push({ espnId, name: athlete.fullName ?? athlete.displayName });
  }
  return out;
}

function fileFor(position, rows) {
  const header = `// Generated by scripts/sync-players.mjs - do not edit by hand.
//
// The ${position.noun}s each team lines up, with the ESPN player id their
// headshot is keyed on. Generated rather than typed out because both
// halves of a row go stale on their own schedule: depth charts change
// week to week, and a player id guessed wrong doesn't fail loudly - it
// renders a different person's face under the right name.
//
// Empty until the script has been run once. The tier list category is
// registered off the length of this array (see tierTemplates.ts), so an
// unsynced checkout simply doesn't offer the category rather than
// offering one full of blanks.
import { TeamAbbr } from "@/data/teams";

export type ${position.typeName} = {
  // ESPN's player id, which is also what its headshot URL is keyed on.
  espnId: string;
  name: string;
  team: TeamAbbr;
};

export const ${position.exportName}: ${position.typeName}[] = [
`;
  const body = rows
    .map((r) => `  { espnId: "${r.espnId}", name: ${JSON.stringify(r.name)}, team: "${r.team}" },`)
    .join("\n");
  return `${header}${body}\n];\n`;
}

async function syncPosition(season, teams, position) {
  console.log(`\n=== ${position.exportName} (${position.perTeam} per team) ===`);
  const rows = [];
  const guessed = [];
  const short = [];

  for (const team of teams) {
    const abbr = (ESPN_TO_OURS[team.abbreviation] ?? team.abbreviation).toUpperCase();
    const roster = await rosterAt(team.id, position.slots);
    let picks = await depthChartAt(season, team.id, position.slots, position.perTeam);
    let source = "depth chart";

    if (picks.length < position.perTeam) {
      // Top up from the roster rather than dropping the team. Roster
      // order is roughly jersey number, which has nothing to do with who
      // starts - so this is always called out, never silent.
      const have = new Set(picks.map((p) => p.espnId));
      for (const candidate of roster) {
        if (picks.length >= position.perTeam) break;
        if (!have.has(candidate.espnId)) picks.push(candidate);
      }
      source = picks.length ? "PARTLY ROSTER ORDER" : source;
      if (picks.length) guessed.push(abbr);
    }
    if (picks.length < position.perTeam) short.push(`${abbr} (${picks.length})`);

    const taken = new Set(picks.map((p) => p.espnId));
    const others = roster.filter((r) => !taken.has(r.espnId)).map((r) => r.name);
    console.log(
      `${abbr.padEnd(4)} ${picks.map((p) => `${p.espnId} ${p.name}`).join(" | ").padEnd(46)} ` +
        `[${source}]${others.length ? `  behind: ${others.join(", ")}` : ""}`,
    );
    for (const pick of picks) rows.push({ ...pick, team: abbr });
  }

  // A partial file is worse than none: a category quietly missing five
  // teams looks like a finished list to everyone who didn't run this.
  if (short.length) throw new Error(`Not enough ${position.noun}s for: ${short.join(", ")}`);
  if (guessed.length) {
    console.log(
      `\nWARNING: ${position.exportName} fell back to roster order for ${guessed.join(", ")} - ` +
        `that is not who starts. Check those before merging.`,
    );
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(DATA, position.file), fileFor(position, rows));
  console.log(`Wrote ${rows.length} to src/data/${position.file}`);
}

async function main() {
  const season = (await json(`${SITE}/scoreboard`)).season?.year;
  if (!season) throw new Error("Could not determine the current season from the scoreboard");
  console.log(`Season ${season}`);

  const teams = (await json(`${SITE}/teams`)).sports[0].leagues[0].teams.map((t) => t.team);
  if (teams.length !== 32) throw new Error(`Expected 32 teams, got ${teams.length}`);

  for (const position of POSITIONS) await syncPosition(season, teams, position);
}

// Guarded so the offline harness can import the parsing without the
// script firing 200 requests at ESPN on import.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { depthChartAt, rosterAt, syncPosition, POSITIONS, main };
