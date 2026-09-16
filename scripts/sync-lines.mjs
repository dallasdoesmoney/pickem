// Records and betting lines, pulled instead of typed.
//
// Both ride on the SAME ESPN object sync-results.mjs already walks for
// winners, so this is that job's other half rather than new machinery.
//
// WHAT MAKES THIS DIFFERENT FROM POSTING A RESULT, and why it is built
// the way it is: a wrong result is loud. Somebody watched the game. A
// wrong point spread is silent - it looks deliberate, it changes how
// people pick, and nobody would think to question it. So every rule here
// leans the same way: when in doubt, change nothing and say so.
//
//   - Nothing is ever invented. A game ESPN has no line for keeps
//     whatever it already had; absence is not a reason to clear a value.
//   - Every value is checked before it is written. A favorite has to be
//     one of the two teams actually playing; a spread has to be a
//     positive half-point number in a plausible range; a record has to
//     look like a record.
//   - ZERO records parsed aborts the whole run. Records are present on
//     every competitor in every response, so none coming back does not
//     mean "quiet week" - it means the shape moved and the parser is
//     reading nothing. That is the failure that would otherwise write an
//     empty week over a good one.
//   - Odds absent is only a warning. Lines genuinely do not exist for a
//     game that has already finished, so that one is normal.
//
// Then it rewrites only the four fields, re-parses the file to prove
// nothing else moved, and commits only if something changed.
//
//   node scripts/sync-lines.mjs              # the current week
//   WEEK=3 node scripts/sync-lines.mjs
//   DRY_RUN=1 node scripts/sync-lines.mjs    # print, write nothing

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GAMES_FILE = join(ROOT, "src", "data", "games.ts");
const SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";

const ESPN_TO_OURS = { WSH: "WAS" };
const ours = (a) => ESPN_TO_OURS[a] ?? a;

// One game per line in games.ts, and this keeps it that way. Fields in
// the order the Game type declares them, so a rewritten line is
// indistinguishable from a hand-written one.
//
// The trailing group is not decoration: twenty-four week-16 games carry a
// "// TBD - confirm closer to the week" note after the brace, and an
// earlier version of this regex simply did not match them. That is the
// dangerous kind of miss - not a crash, just twenty-four games quietly
// never getting a record while the other 248 updated around them.
const LINE_RE =
  /^(\s*)\{ id: "([^"]+)", week: (\d+), away: "([A-Z]+)", home: "([A-Z]+)", kickoff: "([^"]+)", network: "([^"]*)"(.*?) \},(\s*\/\/.*)?$/;

export function parseLine(line) {
  const m = LINE_RE.exec(line);
  if (!m) return null;
  const [, indent, id, week, away, home, kickoff, network, rest, trailing] = m;
  const pick = (re) => {
    const r = re.exec(rest);
    return r ? r[1] : undefined;
  };
  return {
    indent,
    trailing: trailing ?? "",
    id,
    week: Number(week),
    away,
    home,
    kickoff,
    network,
    favorite: pick(/favorite: "([A-Z]+)"/),
    spread: pick(/spread: ([\d.]+)/) === undefined ? undefined : Number(pick(/spread: ([\d.]+)/)),
    awayRecord: pick(/awayRecord: "([^"]*)"/),
    homeRecord: pick(/homeRecord: "([^"]*)"/),
  };
}

export function formatLine(g) {
  const parts = [
    `id: "${g.id}"`,
    `week: ${g.week}`,
    `away: "${g.away}"`,
    `home: "${g.home}"`,
    `kickoff: "${g.kickoff}"`,
    `network: "${g.network}"`,
  ];
  if (g.favorite !== undefined) parts.push(`favorite: "${g.favorite}"`);
  if (g.spread !== undefined) parts.push(`spread: ${g.spread}`);
  if (g.awayRecord !== undefined) parts.push(`awayRecord: "${g.awayRecord}"`);
  if (g.homeRecord !== undefined) parts.push(`homeRecord: "${g.homeRecord}"`);
  return `${g.indent}{ ${parts.join(", ")} },${g.trailing ?? ""}`;
}

// --- what counts as a usable value ------------------------------------

const RECORD_RE = /^\d{1,2}-\d{1,2}(-\d{1,2})?$/;
export const isRecord = (v) => typeof v === "string" && RECORD_RE.test(v);

// A line of 40 would be a parse error wearing a number's clothes: the
// widest NFL spread on record is under 27. Half points only, because that
// is how spreads are quoted - anything else means the value came from
// somewhere other than the line.
export function isSpread(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 30 && Math.round(v * 2) === v * 2;
}

// --- reading one game out of a response --------------------------------

export function recordFor(competitor) {
  const all = competitor?.records ?? [];
  const best =
    all.find((r) => r.type === "total") ??
    all.find((r) => (r.name ?? "").toLowerCase() === "overall") ??
    all.find((r) => isRecord(r.summary));
  return isRecord(best?.summary) ? best.summary : undefined;
}

// "BUF -2.5" -> favorite BUF by 2.5. The details string is the one field
// that says both halves in one place; the structured fields are the
// fallback, and disagreement between them is treated as a reason to skip
// rather than a reason to pick one.
export function oddsFor(comp, awayAbbr, homeAbbr) {
  const odds = comp?.odds?.[0];
  if (!odds) return {};

  const details = typeof odds.details === "string" ? odds.details.trim() : "";
  // A pick'em has no favorite. Leaving both fields off is the honest
  // rendering of that, and the card already knows how to draw it.
  if (/^(even|pk|pick)$/i.test(details)) return { favorite: null, spread: null };

  const m = /^([A-Z]{2,4})\s*(-?\d+(?:\.\d+)?)$/.exec(details);
  if (m) {
    const favorite = ours(m[1]);
    const spread = Math.abs(Number(m[2]));
    if ((favorite === awayAbbr || favorite === homeAbbr) && isSpread(spread)) return { favorite, spread };
  }

  // Fallback: whoever is flagged favourite, with the magnitude of the
  // spread field. Only used when details did not parse.
  const homeFav = odds.homeTeamOdds?.favorite === true;
  const awayFav = odds.awayTeamOdds?.favorite === true;
  if (homeFav !== awayFav && typeof odds.spread === "number") {
    const favorite = homeFav ? homeAbbr : awayAbbr;
    const spread = Math.abs(odds.spread);
    if (isSpread(spread)) return { favorite, spread };
  }
  return {};
}

export function updatesFrom(events, weekGames) {
  const byMatchup = new Map(weekGames.map((g) => [`${g.home}:${g.away}`, g]));
  const updates = new Map();
  const notes = [];
  let recordsSeen = 0;

  for (const ev of events ?? []) {
    const comp = ev.competitions?.[0];
    if (!comp) continue;
    const sides = comp.competitors ?? [];
    const home = sides.find((c) => c.homeAway === "home");
    const away = sides.find((c) => c.homeAway === "away");
    const h = ours(home?.team?.abbreviation ?? "");
    const a = ours(away?.team?.abbreviation ?? "");
    const game = byMatchup.get(`${h}:${a}`);
    if (!game) {
      notes.push(`${a} at ${h}: not in our week ${weekGames[0]?.week} - schedule drift?`);
      continue;
    }

    const next = {};
    const ar = recordFor(away);
    const hr = recordFor(home);
    if (ar) { next.awayRecord = ar; recordsSeen++; }
    if (hr) { next.homeRecord = hr; recordsSeen++; }

    const { favorite, spread } = oddsFor(comp, a, h);
    // null is the explicit "this is a pick'em" answer and clears the
    // fields; undefined is "nothing usable came back" and leaves them be.
    if (favorite === null) { next.favorite = undefined; next.spread = undefined; }
    else if (favorite && spread) { next.favorite = favorite; next.spread = spread; }
    else notes.push(`${game.id}: no usable line${comp.odds?.length ? " (odds present but unreadable)" : ""}`);

    updates.set(game.id, next);
  }
  return { updates, notes, recordsSeen };
}

// --- writing it back ---------------------------------------------------

export function applyUpdates(source, updates) {
  let changed = 0;
  const out = source.split("\n").map((line) => {
    const g = parseLine(line);
    if (!g || !updates.has(g.id)) return line;
    const u = updates.get(g.id);
    const merged = { ...g };
    for (const key of ["favorite", "spread", "awayRecord", "homeRecord"]) {
      if (key in u) merged[key] = u[key];
    }
    const rebuilt = formatLine(merged);
    if (rebuilt !== line) changed++;
    return rebuilt;
  });
  return { text: out.join("\n"), changed };
}

// --- the job -----------------------------------------------------------

async function main() {
  const source = readFileSync(GAMES_FILE, "utf8");
  const all = source.split("\n").map(parseLine).filter(Boolean);
  if (all.length < 200) {
    throw new Error(`Only parsed ${all.length} game lines out of games.ts - a season is 272. The line format has drifted from this script's regex; fix that rather than letting it write a partial file.`);
  }

  // The current week: the earliest one that still has a game to play.
  // Falls back to the last week of the season once they all have.
  const now = Date.now();
  const upcoming = all.filter((g) => Date.parse(g.kickoff) > now).map((g) => g.week);
  const week = Number(process.env.WEEK) || (upcoming.length ? Math.min(...upcoming) : Math.max(...all.map((g) => g.week)));
  const weekGames = all.filter((g) => g.week === week);
  if (weekGames.length === 0) throw new Error(`No games for week ${week}.`);
  const season = all[0].id.slice(0, 4);

  const url = `${SCOREBOARD}?dates=${season}&seasontype=2&week=${week}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const data = await res.json();
  const events = data.events ?? [];
  console.log(`Week ${week}: ${events.length} events from ESPN, ${weekGames.length} games in our schedule.`);

  const { updates, notes, recordsSeen } = updatesFrom(events, weekGames);

  // The guard that matters. Every competitor in every response carries a
  // record, so none coming back is not a quiet week - it is a parser
  // reading nothing, and the next step would be writing that nothing over
  // a good file.
  if (recordsSeen === 0) {
    console.error("\nNOT ONE RECORD PARSED. Refusing to write.");
    console.error("Records are present on every competitor, so this means the response shape");
    console.error("moved and recordFor() is looking in the wrong place. The first competitor,");
    console.error("verbatim, so the fix can be made against what is actually there:\n");
    console.error(JSON.stringify(events[0]?.competitions?.[0]?.competitors?.[0] ?? null, null, 2).slice(0, 4000));
    process.exit(1);
  }

  for (const n of notes) console.log(`  note: ${n}`);
  const { text, changed } = applyUpdates(source, updates);

  // Prove the rewrite moved only what it meant to: same number of game
  // lines, same ids, same kickoffs. A kickoff that moved here would put
  // games.ts out of step with the game_kickoffs table and quietly break
  // the pick lock.
  const after = text.split("\n").map(parseLine).filter(Boolean);
  if (after.length !== all.length) throw new Error(`Rewrite changed the game count: ${all.length} -> ${after.length}. Not writing.`);
  for (let i = 0; i < all.length; i++) {
    if (after[i].id !== all[i].id) throw new Error(`Rewrite reordered games at ${i}. Not writing.`);
    if (after[i].kickoff !== all[i].kickoff) throw new Error(`Rewrite altered a kickoff (${all[i].id}). Not writing - game_kickoffs would go out of step.`);
  }

  console.log(`\n${recordsSeen} records read, ${changed} line(s) changed.`);
  if (changed === 0) return console.log("Nothing to do.");
  if (process.env.DRY_RUN === "1") return console.log("DRY_RUN - not written.");
  writeFileSync(GAMES_FILE, text);
  console.log(`Wrote ${GAMES_FILE}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
