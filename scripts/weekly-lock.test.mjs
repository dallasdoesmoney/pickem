// The board in a real browser: a game that has kicked off cannot be
// picked, and the games after it still can.
//
// The unit tests prove the rule and the migration. This proves the rule
// reaches the buttons - which is the part that was actually missing on
// Wednesday night, when the rule existed nowhere at all and every card on
// the board stayed live through a game that had already been played.
//
// Deliberately runs with no database: the REST calls are answered empty,
// fetchWeeks returns nothing, and the page falls back to "this week is
// editable". So the only thing that can disable a card here is its
// kickoff, which is exactly the thing under test - a passing run cannot
// be the old week-level lock in disguise.
//
// Needs a dev server on :3000.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.error("playwright is missing - run `npm i`, then run this again.");
  process.exit(1);
}

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

const browser = await playwright.chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

// Week 1's opener was Wednesday 2026-09-09 at 8:20pm ET (NE at SEA); the
// Sunday slate is 2026-09-13 (TB at CIN). Buttons are found by the logo's
// alt text, which is the team nickname and unique within a week.
const STARTED = { game: "2026-w1-ne-sea", away: "Patriots", home: "Seahawks" };
const LATER = { game: "2026-w1-tb-cin", away: "Buccaneers", home: "Bengals" };

// The clock is pinned so this test says the same thing next December as
// it does today: forty minutes after the Wednesday game kicked off, and
// three days before Sunday's.
const FROZEN = new Date("2026-09-09T21:00:00-04:00").getTime();
// Settable, because the second half of this test is about a board that is
// already open when its game starts.
await page.addInitScript((frozen) => {
  const Real = Date;
  let at = frozen;
  class Frozen extends Real {
    constructor(...args) {
      if (args.length === 0) super(at);
      else super(...args);
    }
    static now() {
      return at;
    }
  }
  globalThis.Date = Frozen;
  globalThis.__setNow = (t) => {
    at = t;
  };
}, FROZEN);

await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const pill = (nickname) => page.locator(`main button:has(img[alt="${nickname}"])`);
const picks = () => page.evaluate(() => JSON.parse(localStorage.getItem("pickem:picks:week-1") ?? "{}"));

// The frozen clock has to have actually taken, or every assertion below
// is testing the real date instead of the one this test chose.
const clockTook = await page.evaluate(() => Date.now());
ok("clock is pinned", clockTook === FROZEN, new Date(clockTook).toISOString());

for (const [label, teams] of [["started", STARTED], ["later", LATER]]) {
  const count = (await pill(teams.away).count()) + (await pill(teams.home).count());
  ok(`found the ${label} card`, count === 2, `${teams.away}/${teams.home}: ${count} buttons`);
}

const startedDisabled = await pill(STARTED.away).isDisabled();
const startedHomeDisabled = await pill(STARTED.home).isDisabled();
const laterDisabled = await pill(LATER.away).isDisabled();
ok("kicked-off game: both halves disabled", startedDisabled && startedHomeDisabled);
ok("later game: still enabled", laterDisabled === false);

// Styling a button as unavailable and refusing the click are different
// claims. This is the second one.
await pill(LATER.away).click();
await page.waitForTimeout(300);
const afterLater = await picks();
ok("clicking a later game records the pick", afterLater[LATER.game] === "TB", JSON.stringify(afterLater));

await pill(STARTED.away).click({ force: true, timeout: 3000 }).catch(() => {});
await page.waitForTimeout(300);
const afterStarted = await picks();
ok("clicking a kicked-off game records nothing", afterStarted[STARTED.game] === undefined, JSON.stringify(afterStarted));

// The part a page reload would hide.
//
// Somebody who opens the board at 12:55 and is still looking at it at
// 1:01 must watch that card go dead on its own. A lock that only applies
// on the next load is a lock you walk around by not reloading - and on a
// Sunday, "left the tab open through kickoff" is the normal case, not the
// edge one.
const SUNDAY = new Date("2026-09-13T13:00:00-04:00").getTime();
ok("Sunday card still live before kickoff", (await pill(LATER.away).isDisabled()) === false);

await page.evaluate((t) => globalThis.__setNow(t), SUNDAY);
// Coming back to a backgrounded tab re-reads the clock immediately -
// phones throttle timers hard enough that this is the path that matters
// most.
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(300);
ok("returning to the tab locks it at kickoff", (await pill(LATER.away).isDisabled()) === true);

// And the interval on its own, with no event to help it: reset to before
// kickoff, let the page settle, then move past kickoff and wait out one
// full 15s tick without touching the tab.
await page.evaluate((t) => globalThis.__setNow(t), FROZEN);
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(300);
ok("reset back to live", (await pill(LATER.away).isDisabled()) === false);
await page.evaluate((t) => globalThis.__setNow(t), SUNDAY);
await page.waitForTimeout(17000);
ok("the interval alone locks it", (await pill(LATER.away).isDisabled()) === true, "no focus event, 17s");

ok("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
console.log(failed === 0 ? "\nall weekly-lock checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
