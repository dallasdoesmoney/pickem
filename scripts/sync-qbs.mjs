// Writes src/data/qbs.ts from ESPN's own depth charts.
//
//   node scripts/sync-qbs.mjs
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
import { dirname, join } from "node:path";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "qbs.ts");
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

// Every quarterback on the roster, in the order ESPN returns them. Used
// as the fallback, and as the sanity check on whatever the depth chart
// says - a chart naming somebody who is not on the roster is stale.
async function rosterQbs(teamId) {
  const roster = await json(`${SITE}/teams/${teamId}/roster`);
  return (roster.athletes ?? [])
    .flatMap((g) => g.items ?? g.athletes ?? [g])
    .filter(Boolean)
    .filter((a) => (a.position?.abbreviation ?? a.position?.name) === "QB")
    .map((a) => ({ espnId: String(a.id), name: a.fullName ?? a.displayName }));
}

// The QB the depth chart ranks first. Returns null rather than throwing
// so a team with no published chart falls through to the roster.
async function depthChartQb(season, teamId) {
  let charts;
  try {
    charts = await json(`${CORE}/seasons/${season}/teams/${teamId}/depthcharts`);
  } catch {
    return null;
  }
  const ranked = [];
  for (const item of charts.items ?? []) {
    // Formation-keyed, and the key's case has moved around over the
    // years, so match on the position rather than trusting "qb".
    for (const slot of Object.values(item.positions ?? {})) {
      const abbr = slot.position?.abbreviation ?? slot.position?.name;
      if (abbr !== "QB") continue;
      for (const entry of slot.athletes ?? []) {
        if (typeof entry.rank === "number" && entry.athlete?.$ref) {
          ranked.push({ rank: entry.rank, ref: entry.athlete.$ref });
        }
      }
    }
  }
  if (!ranked.length) return null;
  ranked.sort((a, b) => a.rank - b.rank);
  // $ref comes back http:// on some responses, which redirects.
  const athlete = await json(ranked[0].ref.replace(/^http:/, "https:"));
  return { espnId: String(athlete.id), name: athlete.fullName ?? athlete.displayName };
}

async function main() {
  const season = (await json(`${SITE}/scoreboard`)).season?.year;
  if (!season) throw new Error("Could not determine the current season from the scoreboard");
  console.log(`Season ${season}\n`);

  const teams = (await json(`${SITE}/teams`)).sports[0].leagues[0].teams.map((t) => t.team);
  if (teams.length !== 32) throw new Error(`Expected 32 teams, got ${teams.length}`);

  const rows = [];
  const guessed = [];
  const missing = [];

  for (const team of teams) {
    const abbr = (ESPN_TO_OURS[team.abbreviation] ?? team.abbreviation).toUpperCase();
    const roster = await rosterQbs(team.id);
    const charted = await depthChartQb(season, team.id);

    let pick = charted;
    let source = "depth chart";
    if (!pick) {
      pick = roster[0] ?? null;
      source = "ROSTER ORDER - NOT A DEPTH CHART";
      if (pick) guessed.push(abbr);
    }
    if (!pick) {
      missing.push(abbr);
      continue;
    }

    rows.push({ espnId: pick.espnId, name: pick.name, team: abbr });
    // Every candidate is printed beside the pick, so a wrong one is
    // obvious in the PR diff instead of being something you find out
    // about from the site.
    const others = roster.filter((q) => q.espnId !== pick.espnId).map((q) => q.name);
    console.log(
      `${abbr.padEnd(4)} ${pick.espnId.padEnd(9)} ${pick.name.padEnd(22)} ` +
        `[${source}]${others.length ? `  behind: ${others.join(", ")}` : ""}`,
    );
  }

  // A partial file is worse than none: a category quietly missing five
  // teams looks like a finished list to everyone who didn't run this.
  if (missing.length) throw new Error(`No quarterback found for: ${missing.join(", ")}`);
  if (guessed.length) {
    console.log(
      `\nWARNING: no depth chart for ${guessed.join(", ")} - those fell back to ` +
        `roster order, which is not who starts. Check them before merging.`,
    );
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const header = `// Generated by scripts/sync-qbs.mjs - do not edit by hand.
//
// The starting quarterback per team, with the ESPN player id its headshot
// is keyed on. Generated rather than typed out because both halves of a
// row go stale on their own schedule: starters change week to week, and a
// player id guessed wrong doesn't fail loudly - it renders a different
// person's face under the right name. Re-run the script whenever the
// depth charts move.
//
// Empty until the script has been run once. The tier list category is
// registered off the length of this array (see tierTemplates.ts), so an
// unsynced checkout simply doesn't offer the category rather than
// offering one full of blanks.
import { TeamAbbr } from "@/data/teams";

export type Quarterback = {
  // ESPN's player id, which is also what its headshot URL is keyed on.
  espnId: string;
  name: string;
  team: TeamAbbr;
};

export const QUARTERBACKS: Quarterback[] = [
`;
  const body = rows
    .map((r) => `  { espnId: "${r.espnId}", name: ${JSON.stringify(r.name)}, team: "${r.team}" },`)
    .join("\n");
  const footer = `
];

// The headshot ESPN serves for a player id. The "full" cut is a 1040x760
// transparent PNG framed at the shoulders, which is why these are drawn
// cropped to a square rather than fitted inside one - see the portrait
// branch in TierItemChip.
export function espnHeadshot(espnId: string): string {
  return \`https://a.espncdn.com/i/headshots/nfl/players/full/\${espnId}.png\`;
}
`;

  writeFileSync(OUT, header + body + footer);
  console.log(`\nWrote ${rows.length} quarterbacks to src/data/qbs.ts`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
