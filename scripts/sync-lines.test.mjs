// The lines sync, tested against a fixture rather than the network.
//
// This sandbox cannot reach site.api.espn.com - the egress proxy denies
// it - so the parser was written against ESPN's documented shape and
// these fixtures encode it. That is worth being honest about: if the real
// response differs, THESE TESTS WILL STILL PASS. What protects the live
// file in that case is not this file, it is the zero-records guard in the
// script, and the cases below prove that guard actually fires.
//
// So the split is deliberate. The happy path here says "given this shape,
// the right values come out". The refusal cases say "given anything else,
// nothing gets written" - and that second half holds whether or not the
// first half guessed right.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseLine, formatLine, applyUpdates, updatesFrom, recordFor, oddsFor, isSpread, isRecord } from "./sync-lines.mjs";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(54)} ${detail}`);
  if (!cond) failed++;
}

// --- the file format ---------------------------------------------------
const BARE = `  { id: "2026-w2-det-buf", week: 2, away: "DET", home: "BUF", kickoff: "2026-09-17T20:15:00-04:00", network: "Prime Video" },`;
const FULL = `  { id: "2026-w1-nyj-ten", week: 1, away: "NYJ", home: "TEN", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS", favorite: "TEN", spread: 3 },`;

const bare = parseLine(BARE);
ok("parses a line with no line on it", bare?.id === "2026-w2-det-buf" && bare.favorite === undefined, `${bare?.away} at ${bare?.home}`);
const full = parseLine(FULL);
ok("parses favorite and spread", full?.favorite === "TEN" && full?.spread === 3);
ok("a comment line is not a game", parseLine("  // Neutral-site game (Melbourne)") === null);
ok("round-trips unchanged", formatLine(bare) === BARE && formatLine(full) === FULL, "byte-identical");

// --- reading ESPN ------------------------------------------------------
const competitor = (abbr, summary) => ({
  homeAway: abbr === "BUF" ? "home" : "away",
  team: { abbreviation: abbr },
  records: [{ name: "overall", type: "total", summary }],
});
ok("reads a record", recordFor(competitor("BUF", "1-0")) === "1-0");
ok("reads a record with ties", recordFor(competitor("BUF", "1-0-1")) === "1-0-1");
ok("ignores a junk record", recordFor({ records: [{ type: "total", summary: "n/a" }] }) === undefined);
ok("no records at all is undefined", recordFor({}) === undefined);
// ESPN also carries home/away splits; the overall one is the one meant.
ok("prefers the overall record", recordFor({ records: [{ type: "home", summary: "0-0" }, { type: "total", summary: "2-1" }] }) === "2-1");

const withOdds = (odds) => ({ odds: odds ? [odds] : [] });
{
  // Fields, not exact JSON: the result also carries provenance (which
  // book, and the raw string it was read from) so the run log can show
  // where a number came from, and an exact-shape assertion would break
  // every time that grows.
  const o = oddsFor(withOdds({ details: "BUF -2.5", provider: { name: "ESPN BET" } }), "DET", "BUF");
  ok("reads a details line", o.favorite === "BUF" && o.spread === 2.5, `${o.favorite} -${o.spread}`);
  ok("and says which book it came from", o.from === "ESPN BET" && o.raw === "BUF -2.5", `${o.from} / ${o.raw}`);
  const many = oddsFor({ odds: [{ details: "BUF -2.5" }, { details: "BUF -3" }] }, "DET", "BUF");
  ok("flags when a book was picked out of several", /1 of 2/.test(many.from), many.from);
}
ok("the away team can be the favourite", oddsFor(withOdds({ details: "DET -1" }), "DET", "BUF").favorite === "DET");
ok("maps ESPN's abbreviation", oddsFor(withOdds({ details: "WSH -3" }), "WAS", "DAL").favorite === "WAS");
ok("a pick'em clears the line", oddsFor(withOdds({ details: "EVEN" }), "DET", "BUF").favorite === null);
{
  const o = oddsFor(withOdds({ details: "", homeTeamOdds: { favorite: true }, spread: -6 }), "DET", "BUF");
  ok("falls back to the flags", o.favorite === "BUF" && o.spread === 6, `${o.favorite} -${o.spread}`);
  ok("and marks the fallback as such", /via flags/.test(o.from), o.from);
}
// The one that matters: a favourite who is not in this game is a parse
// error, not a line, and must not reach the file.
ok("refuses a team not in the game", JSON.stringify(oddsFor(withOdds({ details: "KC -3" }), "DET", "BUF")) === "{}");
ok("refuses an absurd number", JSON.stringify(oddsFor(withOdds({ details: "BUF -45" }), "DET", "BUF")) === "{}");
ok("refuses a third of a point", JSON.stringify(oddsFor(withOdds({ details: "BUF -2.33" }), "DET", "BUF")) === "{}");
ok("refuses when both are flagged favourite", JSON.stringify(oddsFor(withOdds({ homeTeamOdds: { favorite: true }, awayTeamOdds: { favorite: true }, spread: -3 }), "DET", "BUF")) === "{}");
ok("no odds at all is empty", JSON.stringify(oddsFor(withOdds(null), "DET", "BUF")) === "{}");
ok("a spread must be positive", !isSpread(0) && !isSpread(-3) && isSpread(2.5));
ok("a record must look like one", isRecord("10-7") && !isRecord("10 - 7") && !isRecord(""));

// --- a whole week ------------------------------------------------------
const weekGames = [bare, parseLine(`  { id: "2026-w2-car-atl", week: 2, away: "CAR", home: "ATL", kickoff: "2026-09-20T13:00:00-04:00", network: "FOX" },`)];
const events = [
  {
    competitions: [{
      odds: [{ details: "BUF -2.5" }],
      competitors: [competitor("BUF", "1-0"), { homeAway: "away", team: { abbreviation: "DET" }, records: [{ type: "total", summary: "0-1" }] }],
    }],
  },
  {
    // Finished game: a real response has no line left on it. Normal, and
    // must not stop the records going in.
    competitions: [{
      odds: [],
      competitors: [
        { homeAway: "home", team: { abbreviation: "ATL" }, records: [{ type: "total", summary: "1-0" }] },
        { homeAway: "away", team: { abbreviation: "CAR" }, records: [{ type: "total", summary: "0-1" }] },
      ],
    }],
  },
];
const { updates, recordsSeen, notes } = updatesFrom(events, weekGames);
ok("every record was read", recordsSeen === 4, `${recordsSeen}`);
ok("the line landed on the right game", updates.get("2026-w2-det-buf").favorite === "BUF");
ok("records landed on the right sides", updates.get("2026-w2-det-buf").awayRecord === "0-1" && updates.get("2026-w2-det-buf").homeRecord === "1-0");
ok("a game with no line still gets records", updates.get("2026-w2-car-atl").awayRecord === "0-1" && !("favorite" in updates.get("2026-w2-car-atl")));
ok("and says so rather than silently", notes.some((n) => n.includes("no usable line")), notes.join(" | "));

// --- writing it back ---------------------------------------------------
const SOURCE = [
  "export const WEEK_2_GAMES: Game[] = [",
  "  // A comment that must survive.",
  BARE,
  FULL,
  "];",
].join("\n");
const { text, changed } = applyUpdates(SOURCE, updates);
ok("only the matched line changed", changed === 1, `${changed}`);
ok("the comment survived", text.includes("// A comment that must survive."));
ok("the untouched game is byte-identical", text.includes(FULL));
const written = parseLine(text.split("\n")[2]);
ok("fields land in the declared order", text.split("\n")[2].includes(`network: "Prime Video", favorite: "BUF", spread: 2.5, awayRecord: "0-1", homeRecord: "1-0"`), text.split("\n")[2].trim().slice(0, 60));
ok("kickoff untouched", written.kickoff === bare.kickoff, "game_kickoffs stays in step");

// A second run over its own output must be a no-op, or the scheduled job
// would commit on every tick forever.
const again = applyUpdates(text, updates);
ok("re-running changes nothing", again.changed === 0, `${again.changed}`);

// An update that arrives empty leaves the line exactly as it was - the
// difference between "no news" and "no line", which is what stops a quiet
// week erasing a good one.
const noNews = applyUpdates(FULL, new Map([["2026-w1-nyj-ten", {}]]));
ok("an empty update is a no-op", noNews.changed === 0 && noNews.text === FULL);

// --- the guard, against shapes I did NOT write the parser for ---------
// This is the half that holds even if the fixtures above encode the wrong
// schema. Each of these is a plausible way for the response to have moved
// since; every one must produce zero records, because zero records is
// what makes main() refuse to write.
{
  const one = parseLine(BARE);
  const shapes = {
    "records renamed to 'record'": [{ competitions: [{ competitors: [{ homeAway: "home", team: { abbreviation: "BUF" }, record: "1-0" }, { homeAway: "away", team: { abbreviation: "DET" }, record: "0-1" }] }] }],
    "records nested under team": [{ competitions: [{ competitors: [{ homeAway: "home", team: { abbreviation: "BUF", record: { items: [{ summary: "1-0" }] } } }] }] }],
    "competitors gone": [{ competitions: [{ odds: [{ details: "BUF -2.5" }] }] }],
    "no events at all": [],
    "summary is a number": [{ competitions: [{ competitors: [{ homeAway: "home", team: { abbreviation: "BUF" }, records: [{ type: "total", summary: 1 }] }] }] }],
  };
  for (const [name, events] of Object.entries(shapes)) {
    const { recordsSeen, updates } = updatesFrom(events, [one]);
    const { changed } = applyUpdates(BARE, updates);
    ok(`unrecognised shape writes nothing: ${name}`, recordsSeen === 0 && changed === 0, `records ${recordsSeen}, changed ${changed}`);
  }
}

// --- the real file, all 272 lines -------------------------------------
// The single biggest risk is not a misread spread, it is this rewriter
// mangling a line it did not understand. Parsing every real game and
// re-emitting it byte-identically is what rules that out.
{
  const real = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "games.ts"), "utf8");
  const lines = real.split("\n");
  const parsed = lines.map(parseLine);
  const games = parsed.filter(Boolean);
  ok("parses every game in the real file", games.length === 272, `${games.length} of 272`);

  const mangled = lines.filter((line, i) => parsed[i] && formatLine(parsed[i]) !== line);
  ok("every real line round-trips byte-identically", mangled.length === 0, mangled.slice(0, 2).map((l) => l.trim().slice(0, 50)).join(" | "));

  // And an empty update set must leave the entire file untouched.
  const { text, changed } = applyUpdates(real, new Map());
  ok("no updates leaves the file alone", changed === 0 && text === real);
}

console.log(failed === 0 ? "\nall sync-lines checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
