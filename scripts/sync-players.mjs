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

// Their own directory, so the workflow that commits them can name the
// DIRECTORY rather than a list of files. Listing them meant adding a
// category silently produced a roster the scheduled sync then refused to
// commit - the sort of gap that shows up a month later as "why is that
// tier list stale".
const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "rosters");

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
  {
    file: "tes.ts",
    typeName: "TightEnd",
    exportName: "TIGHT_ENDS",
    noun: "tight end",
    // One apiece, like quarterback: a team has a starting tight end even
    // when it lines two up, and the second is a blocker nobody is
    // arguing about.
    slots: (abbr) => abbr === "TE",
    perTeam: 1,
  },
  {
    file: "ks.ts",
    typeName: "Kicker",
    exportName: "KICKERS",
    noun: "kicker",
    // ESPN has used PK for the place kicker and plain K in places.
    // Matching both, and NOT the punter, who is a different job however
    // often the two get confused.
    slots: (abbr) => abbr === "PK" || abbr === "K",
    perTeam: 1,
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

// The attributes the daily puzzle grades a guess against. Every one is
// optional: ESPN omits them for some players, and the puzzle hides a
// column nobody has a value for rather than showing a row of "?".
//
// This used to keep only id and name and throw the rest of the payload
// away. Nothing extra is fetched to get these - they were already in the
// response, and were being discarded.
// Absent keys are LEFT OUT rather than set to undefined. A row is
// compared and written as a whole, so `{ heightIn: undefined }` is not
// the same object as `{}` - the offline test caught exactly that, which
// is the only reason it did not reach a live run.
function attrsOf(a) {
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
  };
  const out = {};
  // ESPN reports height in inches and weight in pounds.
  const put = (key, value) => {
    if (value !== undefined) out[key] = value;
  };
  put("heightIn", num(a.height));
  put("weightLb", num(a.weight));
  put("age", num(a.age));
  put("jersey", num(a.jersey));
  // college is a $ref on the core API and an object on the roster
  // endpoint. Only the inline form is used - chasing the ref would be one
  // more request per player for one hint column.
  put("college", typeof a.college?.name === "string" ? a.college.name : undefined);
  return out;
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
    .map((a) => ({ espnId: String(a.id), name: a.fullName ?? a.displayName, ...attrsOf(a) }));
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
    out.push({ espnId, name: athlete.fullName ?? athlete.displayName, ...attrsOf(athlete) });
  }
  return out;
}

// ---------------------------------------------------------- every player
//
// The daily puzzle lets you GUESS anyone on a 53-man roster but only ever
// ANSWERS with someone off a depth chart. That split is the whole point:
// an answer pool of everybody includes third-string guards and practice
// squad safeties, and no set of hints rescues a player nobody can name.
// Poeltl and Weddle draw the same line.
//
// So this writes one file with both facts in it - the roster, and whether
// ESPN's depth chart mentions the player anywhere at any rank.

// Every athlete id that appears anywhere on a team's depth chart, at any
// position and any rank. Deliberately not the top-N-per-position that
// syncPosition asks for: a second-string corner is a fine answer, a
// player the chart has never heard of is not.
async function depthChartIdsAt(season, teamId) {
  const ids = new Set();
  let chart;
  try {
    chart = await json(`${CORE}/seasons/${season}/teams/${teamId}/depthcharts`);
  } catch {
    // No published chart. Everyone on this roster stays guess-only rather
    // than the whole team becoming answerable.
    return ids;
  }
  for (const item of chart.items ?? []) {
    for (const slot of Object.values(item.positions ?? {})) {
      for (const entry of slot.athletes ?? []) {
        const ref = entry.athlete?.$ref;
        const hit = ref && /athletes\/(\d+)/.exec(ref);
        if (hit) ids.add(hit[1]);
      }
    }
  }
  return ids;
}

// Everyone on a team's roster, at every position, with their real
// position abbreviation rather than one of our five buckets.
async function fullRosterAt(teamId) {
  const roster = await json(`${SITE}/teams/${teamId}/roster`);
  return (roster.athletes ?? [])
    .flatMap((g) => g.items ?? g.athletes ?? [g])
    .filter(Boolean)
    .filter((a) => a.id && (a.fullName || a.displayName))
    .map((a) => ({
      espnId: String(a.id),
      name: a.fullName ?? a.displayName,
      position: String(a.position?.abbreviation ?? a.position?.name ?? "").toUpperCase() || "?",
      ...attrsOf(a),
    }));
}

function allPlayersFile(rows) {
  const header = `// Generated by scripts/sync-players.mjs - do not edit by hand.
//
// Every active player, for the daily puzzle. You can guess anyone in
// here; the answer is only ever drawn from the ones marked answerable,
// which means ESPN's depth chart mentions them somewhere. An answer pool
// of all 1,700 would include third-string guards nobody can name.
//
// Empty until the script has been run once, and the puzzle falls back to
// the five position rosters when it is - see src/data/puzzlePlayers.ts -
// so an unsynced checkout plays a smaller game rather than none.
import { TeamAbbr } from "@/data/teams";

export type ActivePlayer = {
  espnId: string;
  name: string;
  team: TeamAbbr;
  // ESPN's own abbreviation: QB, RB, WR, TE, K, but also OT, CB, EDGE,
  // LS and the rest. Not one of our five buckets.
  position: string;
  // On a depth chart somewhere, at any rank. Only these can be the
  // answer.
  answerable: boolean;
  heightIn?: number;
  weightLb?: number;
  age?: number;
  jersey?: number;
  college?: string;
};

export const ACTIVE_PLAYERS: ActivePlayer[] = [
`;
  const extra = (r) =>
    [
      r.heightIn ? `, heightIn: ${r.heightIn}` : "",
      r.weightLb ? `, weightLb: ${r.weightLb}` : "",
      r.age ? `, age: ${r.age}` : "",
      r.jersey ? `, jersey: ${r.jersey}` : "",
      r.college ? `, college: ${JSON.stringify(r.college)}` : "",
    ].join("");
  const body = rows
    .map(
      (r) =>
        `  { espnId: "${r.espnId}", name: ${JSON.stringify(r.name)}, team: "${r.team}", ` +
        `position: "${r.position}", answerable: ${r.answerable}${extra(r)} },`,
    )
    .join("\n");
  return `${header}${body}\n];\n`;
}

async function syncAllPlayers(season, teams) {
  console.log(`\n=== ACTIVE_PLAYERS (every roster) ===`);
  const rows = [];
  const seen = new Set();

  for (const team of teams) {
    const abbr = (ESPN_TO_OURS[team.abbreviation] ?? team.abbreviation).toUpperCase();
    const [roster, charted] = await Promise.all([fullRosterAt(team.id), depthChartIdsAt(season, team.id)]);
    let answerable = 0;
    for (const player of roster) {
      // A player on two teams' pages mid-trade would otherwise appear
      // twice in the dropdown and break the guess-once rule.
      if (seen.has(player.espnId)) continue;
      seen.add(player.espnId);
      const isAnswerable = charted.has(player.espnId);
      if (isAnswerable) answerable += 1;
      rows.push({ ...player, team: abbr, answerable: isAnswerable });
    }
    console.log(`${abbr.padEnd(4)} ${String(roster.length).padStart(3)} players, ${String(answerable).padStart(3)} answerable`);
  }

  // A roster this short means ESPN changed shape or half the requests
  // failed, and writing it would shrink the guess list to something that
  // rejects real names.
  if (rows.length < 1000) throw new Error(`Only ${rows.length} active players - expected upwards of 1,500`);
  const answerable = rows.filter((r) => r.answerable).length;
  if (answerable < 200) throw new Error(`Only ${answerable} answerable players - the depth chart parse found almost nothing`);

  rows.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(DATA, "all.ts"), allPlayersFile(rows));
  console.log(`Wrote ${rows.length} to src/data/rosters/all.ts (${answerable} answerable)`);
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
  // Hint columns for the daily player puzzle. Optional because ESPN does
  // not publish all of them for everyone; the puzzle hides a column it
  // has no values for rather than showing a row of "?".
  heightIn?: number;
  weightLb?: number;
  age?: number;
  jersey?: number;
  college?: string;
};

export const ${position.exportName}: ${position.typeName}[] = [
`;
  // Optional fields are omitted rather than written as undefined, so a
  // player ESPN says nothing about stays a short line.
  const extra = (r) =>
    [
      r.heightIn ? `, heightIn: ${r.heightIn}` : "",
      r.weightLb ? `, weightLb: ${r.weightLb}` : "",
      r.age ? `, age: ${r.age}` : "",
      r.jersey ? `, jersey: ${r.jersey}` : "",
      r.college ? `, college: ${JSON.stringify(r.college)}` : "",
    ].join("");
  const body = rows
    .map((r) => `  { espnId: "${r.espnId}", name: ${JSON.stringify(r.name)}, team: "${r.team}"${extra(r)} },`)
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
  console.log(`Wrote ${rows.length} to src/data/rosters/${position.file}`);
}

// ---------------------------------------------------------------- coaches
//
// Head coaches are not on a depth chart, so this is its own fetch - and
// the first version of it asked the wrong endpoint. The team object does
// NOT carry a coach: the run found nothing for all 32 and refused to
// write, which is the guard working, but it cost a run to learn. The
// coach rides on the ROSTER response instead, as a top-level `coach`
// array beside `athletes`.
//
// Called with whichever payload is to hand, and it digs rather than
// assuming a shape: `coach`, `coaches`, an array, or a wrapped list.
// A shape change here does not throw, it silently shrinks the list.
export function coachFrom(payload) {
  const raw = payload?.coach ?? payload?.coaches ?? payload?.team?.coach ?? payload?.team?.coaches;
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : raw ? [raw] : [];
  const named = list.filter((c) => c?.id);
  if (!named.length) return null;

  // The HEAD coach, not whoever the staff list happens to start with.
  // Taking [0] returned Jesse Minter for Baltimore and Todd Monken for
  // Cleveland - both coordinators - because this array is the whole
  // staff. Where nothing says which one is in charge, fall back to the
  // first, but say so, since a coordinator in a head coach list is
  // wrong in a way that looks completely normal.
  const title = (c) =>
    String(c.position?.name ?? c.position?.displayName ?? c.position ?? c.title ?? "").toLowerCase();
  const head = named.find((c) => title(c).includes("head coach"));
  const pick = head ?? named[0];

  const name =
    pick.displayName ??
    pick.fullName ??
    [pick.firstName, pick.lastName].filter(Boolean).join(" ").trim();
  if (!name) return null;
  return {
    espnId: String(pick.id),
    name,
    // ESPN sometimes hands the picture over rather than making us build
    // the URL. Given four of 32 resolved from a guessed path last run,
    // its own answer beats ours whenever it offers one.
    headshot: pick.headshot?.href ?? pick.headshot ?? pick.image?.href ?? "",
    // False when nothing in the payload said "head coach", so the run
    // can flag which teams were a guess.
    titled: Boolean(head),
    staffSize: named.length,
  };
}

// A coach's headshot is not at the players path, and the coaches path has
// not always existed - so rather than hard-code a URL that renders the
// wrong thing or nothing, ask, and write down the one that answered. A
// guessed URL fails as a grey tile weeks later on somebody's board; this
// fails here, in the run, with a line saying which coach.
const HEADSHOT_PATTERNS = [
  (id) => `https://a.espncdn.com/i/headshots/nfl/coaches/full/${id}.png`,
  (id) => `https://a.espncdn.com/i/headshots/nfl/players/full/${id}.png`,
];

async function resolveHeadshot(espnId) {
  for (const pattern of HEADSHOT_PATTERNS) {
    const url = pattern(espnId);
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok) return url;
    } catch {
      // Network blip on one candidate should not rule the pattern out.
    }
  }
  return "";
}

function coachesFile(rows) {
  const header = `// Generated by scripts/sync-players.mjs - do not edit by hand.
//
// The head coach of each team, with the ESPN id their headshot is keyed
// on and the headshot URL the sync actually confirmed - coaches do not
// live at the same image path as players, and the path has moved, so the
// working one is recorded rather than rebuilt from a guess.
//
// Empty until the script has been run once. The tier list category is
// registered off the length of this array (see tierTemplates.ts), so an
// unsynced checkout simply doesn't offer the category rather than
// offering one full of blanks.
import { TeamAbbr } from "@/data/teams";

export type Coach = {
  espnId: string;
  name: string;
  team: TeamAbbr;
  // Empty when ESPN had no headshot at any known path. The chip falls
  // back to a team-coloured tile, which still names and colours the man.
  imageUrl: string;
};

export const HEAD_COACHES: Coach[] = [
`;
  const body = rows
    .map(
      (r) =>
        `  { espnId: "${r.espnId}", name: ${JSON.stringify(r.name)}, team: "${r.team}", ` +
        `imageUrl: ${JSON.stringify(r.imageUrl)} },`,
    )
    .join("\n");
  return `${header}${body}\n];\n`;
}

async function syncCoaches(teams) {
  console.log(`\n=== HEAD_COACHES ===`);
  const rows = [];
  const missing = [];
  const faceless = [];
  const untitled = [];

  // Asked in the order they are most likely to answer. The roster is
  // first because that is where the coach actually lives; the other two
  // stay as fallbacks rather than being deleted, since ESPN has moved
  // this before and will again.
  const SOURCES = [
    (id) => `${SITE}/teams/${id}/roster`,
    (id) => `${SITE}/teams/${id}`,
    (id) => `${CORE}/seasons/${new Date().getUTCFullYear()}/teams/${id}/coaches`,
  ];
  let dumped = false;

  for (const team of teams) {
    const abbr = (ESPN_TO_OURS[team.abbreviation] ?? team.abbreviation).toUpperCase();
    let coach = coachFrom(team);
    let last = null;
    for (const source of SOURCES) {
      if (coach) break;
      try {
        last = await json(source(team.id));
        coach = coachFrom(last);
      } catch {
        // Try the next source rather than dropping the team on one 404.
      }
    }
    // Once per run, print one raw coach entry. Two runs have now been
    // spent guessing at this payload from the outside - what fields it
    // carries, whether it says who is the head coach, whether it hands
    // over a picture. One team's worth of JSON in the log answers all of
    // that for good, and costs nothing.
    if (!dumped && last) {
      const raw = last.coach ?? last.coaches ?? last.team?.coach;
      const one = Array.isArray(raw) ? raw[0] : Array.isArray(raw?.items) ? raw.items[0] : raw;
      if (one) {
        dumped = true;
        console.log(`     [shape] staff of ${coach?.staffSize ?? "?"}, first entry:`);
        console.log(`     ${JSON.stringify(one).slice(0, 700)}`);
      }
    }
    if (!coach) {
      missing.push(abbr);
      console.log(`${abbr.padEnd(4)} NO COACH FOUND`);
      if (last && typeof last === "object") {
        console.log(`     last response had keys: ${Object.keys(last).join(", ")}`);
      }
      continue;
    }
    // ESPN's own URL first, ours only if it gave none.
    const imageUrl = coach.headshot || (await resolveHeadshot(coach.espnId));
    if (!imageUrl) faceless.push(`${abbr} ${coach.name}`);
    if (!coach.titled) untitled.push(`${abbr} ${coach.name}`);
    console.log(
      `${abbr.padEnd(4)} ${coach.espnId} ${coach.name.padEnd(24)} ` +
        `[${imageUrl ? (coach.headshot ? "espn-supplied" : "resolved") : "NO HEADSHOT"}]` +
        `${coach.titled ? "" : `  (staff of ${coach.staffSize}, none titled head coach)`}`,
    );
    rows.push({ espnId: coach.espnId, name: coach.name, team: abbr, imageUrl });
  }

  // Same rule as the positions: a list quietly missing five teams looks
  // finished to everyone who did not run this.
  if (missing.length) throw new Error(`No head coach for: ${missing.join(", ")}`);
  if (untitled.length) {
    console.log(
      `\nWARNING: nothing in the payload named a head coach for ${untitled.join(", ")} - ` +
        `those are the first name on the staff list, which is how a coordinator ends up ` +
        `in a head coach tier list looking perfectly normal. Check them before merging.`,
    );
  }
  if (faceless.length) {
    console.log(
      `\nWARNING: no headshot for ${faceless.join(", ")} - those render as team-coloured ` +
        `tiles with the name on. If it is most of them, see the [shape] line above for ` +
        `what ESPN actually hands over.`,
    );
  }

  rows.sort((a, b) => a.name.localeCompare(b.name));
  writeFileSync(join(DATA, "coaches.ts"), coachesFile(rows));
  console.log(`Wrote ${rows.length} to src/data/rosters/coaches.ts`);
}

async function main() {
  const season = (await json(`${SITE}/scoreboard`)).season?.year;
  if (!season) throw new Error("Could not determine the current season from the scoreboard");
  console.log(`Season ${season}`);

  const teams = (await json(`${SITE}/teams`)).sports[0].leagues[0].teams.map((t) => t.team);
  if (teams.length !== 32) throw new Error(`Expected 32 teams, got ${teams.length}`);

  for (const position of POSITIONS) await syncPosition(season, teams, position);

  // After the five, because it is the one that would take the longest to
  // redo by hand if a later step throws.
  await syncAllPlayers(season, teams);

  // Parked, and OFF by default. Two runs established that ESPN gives us
  // a coach list with no head coach marked on it and no photographs:
  // the output was 32 rows, six of them coordinators, and 28 with no
  // face. That is not a tier list, and the category stays unregistered
  // until somebody supplies 32 pictures.
  //
  // It is a switch rather than a deletion because the fetching works -
  // it is the DATA that is not good enough - and because leaving it
  // running would do real damage on a schedule: the weekly job would
  // either fail outright, which stops the five position rosters from
  // updating since the pull request step never runs, or churn a pull
  // request full of coordinators every Tuesday.
  //
  //   SYNC_COACHES=1 node scripts/sync-players.mjs
  if (process.env.SYNC_COACHES === "1") await syncCoaches(teams);
  else console.log(`\n=== HEAD_COACHES: skipped (set SYNC_COACHES=1) ===`);
}

// Guarded so the offline harness can import the parsing without the
// script firing 200 requests at ESPN on import.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { depthChartAt, rosterAt, fullRosterAt, depthChartIdsAt, syncPosition, syncAllPlayers, POSITIONS, main };
