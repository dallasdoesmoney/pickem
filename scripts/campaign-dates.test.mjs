// Does the campaign's copy name the right day?
//
// This exists because it once did not. The week 2 blast was edited to say
// "tonight" off a clock reading 02:30 Thursday UTC - which was 22:30
// WEDNESDAY in Eastern, where the audience reads it. The game was 21
// hours away. Nothing in the pipeline would have caught it: the HTML was
// valid, the send would have succeeded, and 160 people would have been
// told a game was on that night.
//
// So the weekday in the copy is checked against the real kickoff out of
// src/data/games.ts, converted to Eastern. A campaign that names a day
// has to name the right one.
//
// It also refuses relative words - "tonight", "tomorrow" - in anything
// that is not a same-day last call. Those are correct for a few hours and
// wrong for the rest of the window a blast might be sent in, and nobody
// re-reads the copy at the moment they press the button. A campaign
// written and fired inside the final hours is the honest exception and
// says so with SAME_DAY.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

const view = {
  playUrl: "https://sidelinebrew.com/weekly",
  unsubUrl: "https://sidelinebrew.com/unsubscribe?t=x",
  addr: "Sideline Brew",
  logo: "https://sidelinebrew.com/email-logo.png",
};

const EASTERN = "America/New_York";
const dayName = (iso) => new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: EASTERN }).format(new Date(iso));
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Campaigns that make a claim about when something happens. A campaign
// exports OPENER_KICKOFF to opt in; one without it is not time-bound and
// has nothing here to check.
const CAMPAIGNS = ["week2-open", "week1-thursday-lock"];

for (const name of CAMPAIGNS) {
  const mod = await import(`./campaigns/${name}.mjs`);
  const copy = `${mod.SUBJECT}\n${mod.text(view)}\n${mod.html(view)}`;

  // A relative word cannot be right across the whole window a blast might
  // be sent in, so it is simply not allowed.
  const relative = ["tonight", "tomorrow", "today", "this evening"].filter((w) => new RegExp(`\\b${w}\\b`, "i").test(copy));
  if (mod.SAME_DAY) {
    ok(`${name}: same-day blast, relative words allowed`, true, relative.join(", ") || "none used");
  } else {
    ok(`${name}: no relative time words`, relative.length === 0, relative.join(", "));
  }

  if (!mod.OPENER_KICKOFF) {
    ok(`${name}: not time-bound, nothing to check`, true);
    continue;
  }

  const real = dayName(mod.OPENER_KICKOFF);
  const named = DAYS.filter((d) => new RegExp(`\\b${d}\\b`).test(copy));
  ok(`${name}: names a weekday at all`, named.length > 0, named.join(", "));

  // Every weekday the copy mentions has to be a real one for this week -
  // the opener's day, or a later day it legitimately talks about (the
  // Sunday slate, Monday night). What must never appear is a day that
  // contradicts the opener.
  const laterInWeek = ["Friday", "Saturday", "Sunday", "Monday"];
  const wrong = named.filter((d) => d !== real && !laterInWeek.includes(d));
  ok(`${name}: the opener's day is ${real}`, named.includes(real), `copy says ${named.join(", ")}`);
  ok(`${name}: no contradicting weekday`, wrong.length === 0, wrong.join(", "));

  // And the kickoff it claims has to be the one in the schedule, so a
  // copy-pasted campaign cannot quietly carry last week's game.
  const games = readFileSync(join(ROOT, "src", "data", "games.ts"), "utf8");
  ok(`${name}: that kickoff is in the schedule`, games.includes(mod.OPENER_KICKOFF), mod.OPENER_KICKOFF);
}

// The bug itself, reproduced: UTC had already rolled into Thursday while
// Eastern was still on Wednesday. Anything deciding a day name off the
// wrong zone gets it wrong by one, and this is the assertion that says so.
{
  const at = "2026-09-17T02:30:00Z";
  const utcDay = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(new Date(at));
  const etDay = dayName(at);
  ok("UTC and Eastern can disagree about the day", utcDay === "Thursday" && etDay === "Wednesday", `${utcDay} vs ${etDay}`);
}

console.log(failed === 0 ? "\nall campaign-date checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
