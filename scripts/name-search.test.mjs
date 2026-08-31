// Typing a name should not require typing its punctuation.
//
// A third of the guess pool - 346 of 1,800 - carries a period, an
// apostrophe or a hyphen, and each one used to be a small trap: "A.J.
// Brown" did not answer to "aj", and "Ja'Marr Chase" did not answer to
// "jam" because the apostrophe sits between the "ja" and the "marr".
//
// This tests the matcher directly rather than through a browser, because
// the interesting part is a pure function over strings and the failures
// are all specific names. Node runs the TypeScript through its own type
// stripping; there is no build step in front of this.
import { searchKeys, matchRank, looseKey, tightKey } from "../src/lib/nameSearch.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(46)} ${detail}`);
  if (!cond) failed++;
}

function finds(name, query) {
  return matchRank(searchKeys(name), searchKeys(query)) >= 0;
}
function startsWith(name, query) {
  return matchRank(searchKeys(name), searchKeys(query)) === 0;
}

// --- the two Dallas named ---------------------------------------------
ok("aj finds A.J. Brown", startsWith("A.J. Brown", "aj"), "and as a starts-with, so it ranks first");
ok("jam finds Ja'Marr Chase", startsWith("Ja'Marr Chase", "jam"), "");

// --- typing the punctuation still works -------------------------------
ok("a.j. still finds A.J. Brown", finds("A.J. Brown", "a.j."), "nobody is punished for typing it");
ok("ja'marr still finds Ja'Marr Chase", finds("Ja'Marr Chase", "ja'marr"), "");
// Phones and copy-paste produce the curly one; the roster has both.
ok("the curly apostrophe matches too", finds("Ja’Marr Chase", "jamarr"), "U+2019");
ok("and a typed straight quote finds a curly name", finds("Ja’Marr Chase", "ja'marr"), "");

// --- hyphens, and the reason there are two keys -----------------------
ok("amonra finds Amon-Ra St. Brown", startsWith("Amon-Ra St. Brown", "amonra"), "");
ok("amon-ra finds him", startsWith("Amon-Ra St. Brown", "amon-ra"), "");
ok("st brown finds him", finds("Amon-Ra St. Brown", "st brown"), "the loose key keeps word boundaries");
ok("amonrast finds him", finds("Amon-Ra St. Brown", "amonrast"), "the tight key drops them");
ok("vera tucker finds Vera-Tucker", finds("Alijah Vera-Tucker", "vera tucker"), "hyphen typed as a space");
ok("veratucker finds him too", finds("Alijah Vera-Tucker", "veratucker"), "");

// --- the rest of the punctuation in the pool --------------------------
ok("oconnell finds Aidan O'Connell", finds("Aidan O'Connell", "oconnell"), "");
ok("ashawn finds A'Shawn Robinson", startsWith("A'Shawn Robinson", "ashawn"), "");
ok("suffixes do not block a match", startsWith("A.J. Terrell Jr.", "aj terrell"), "Jr. / Sr. / III");
ok("and can still be typed", finds("A.J. Terrell Jr.", "terrell jr"), "");

// --- accents ----------------------------------------------------------
ok("an accent can be left off", finds("José Border", "jose"), "NFD, then drop the marks");
ok("and typed", finds("Jose Border", "josé"), "works from either side");

// --- ranking ----------------------------------------------------------
ok("a starts-with outranks a contains", matchRank(searchKeys("Ja'Marr Chase"), searchKeys("jam")) === 0 && matchRank(searchKeys("Benjamin St-Juste"), searchKeys("jam")) === 1, "Ja'Marr before Benjamin");

// --- it must not match everything -------------------------------------
ok("nonsense matches nothing", !finds("A.J. Brown", "zzzq"), "");
ok("an empty query matches nothing", matchRank(searchKeys("A.J. Brown"), searchKeys("   ")) === -1, "not every player");
ok("punctuation alone matches nothing", matchRank(searchKeys("A.J. Brown"), searchKeys("...")) === -1, "would otherwise be an empty key");

// --- the keys themselves ----------------------------------------------
ok("looseKey keeps one space between words", looseKey("Amon-Ra  St. Brown") === "amonra st brown", looseKey("Amon-Ra  St. Brown"));
ok("tightKey drops them", tightKey("A.J. Brown") === "ajbrown", tightKey("A.J. Brown"));

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
