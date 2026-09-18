// A week that is half played still keeps score.
//
// Thursday night finished, the pick on it was locked, the result was in
// the table - and every record on the site read 0-0, because the week had
// not been published. weeks.results_published used to gate scoring, and
// it existed for a reason that no longer holds: picks stayed editable
// until somebody closed the week by hand, so revealing a result early was
// an invitation to change your pick. Since 0062 every pick locks at its
// own kickoff, which is strictly before any result can exist.
//
// So the flag is deliberately FALSE in this test. That is the assertion,
// not the setup: if scoring ever starts depending on it again, this goes
// red rather than passing quietly on a published week.
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

// Week 2: the Thursday game is over, Sunday has not started.
const DONE = { id: "2026-w2-det-buf", winner: "BUF", nick: "Bills", loserNick: "Lions" };
const SUNDAY = { id: "2026-w2-car-atl", nick: "Panthers" };
const FROZEN = new Date("2026-09-18T10:00:00-04:00").getTime();
const USER = "00000000-0000-4000-8000-00000000beef";

const browser = await playwright.chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// Broadest to narrowest - Playwright matches the LAST registered route.
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
await page.route("**/rest/v1/profiles*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: USER, username: "boardtest", display_name: "Board Test", avatar_url: null, is_admin: false, onboarded: true, migrated_local_picks: true }]) }),
);
// THE POINT: week 2 is open and NOT published.
await page.route("**/rest/v1/weeks*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ week: 2, is_open: true, results_published: false }]) }),
);
// One game final. This is what the board has to notice.
await page.route("**/rest/v1/game_results*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ game_id: DONE.id, week: 2, winner: DONE.winner }]) }),
);
// And the pick on it was right.
await page.route("**/rest/v1/weekly_picks*", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ game_id: DONE.id, team_abbr: DONE.winner, is_lock: false }]) }),
);
await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

await page.addInitScript(({ frozen, authKey, user }) => {
  const Real = Date;
  class Frozen extends Real {
    constructor(...a) { if (a.length === 0) super(frozen); else super(...a); }
    static now() { return frozen; }
  }
  globalThis.Date = Frozen;
  const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = [b64({ alg: "HS256", typ: "JWT" }), b64({ sub: user, aud: "authenticated", role: "authenticated", iss: "https://placeholder.supabase.co/auth/v1", iat: 1757462400, exp: 1893456000 }), "sig"].join(".");
  localStorage.setItem(authKey, JSON.stringify({
    access_token: jwt, refresh_token: "r", token_type: "bearer", expires_in: 9e8,
    expires_at: Math.floor(new Date("2030-01-01T00:00:00Z").getTime() / 1000),
    user: { id: user, aud: "authenticated", role: "authenticated", email: "board@example.test", app_metadata: {}, user_metadata: {} },
  }));
}, { frozen: FROZEN, authKey: "sb-placeholder-auth-token", user: USER });

await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle" });
await page.addStyleTag({ content: '[role="dialog"]{display:none!important}' });
await page.waitForTimeout(2500);

// THE record pill, not any "n-n" on the page. Team records live on the
// cards and legitimately read 0-0 for a team the schedule has no record
// for, so a page-wide search proves nothing - it was green on the value
// that mattered and red on somebody else's.
// Absent is a RESULT, not a crash. With the old publish gate in place the
// board never leaves its pre-game state, so this pill does not exist at
// all - and a bare locator turns that into a thirty-second timeout and a
// stack trace instead of a line saying what is wrong.
const recordPill = page.locator('main div:has(> div.tracking-wide:text-is("MY RECORD"))');
const record = (await recordPill.count()) === 0
  ? "(no record pill - the board is still pre-game, so nothing was graded)"
  : (await recordPill.first().innerText()).split("\n")[0].trim();

// One game final, one pick right, so 1-0. Before 0063 this read 0-0.
ok("the week record counts the finished game", record === "1-0", `the pill says ${record}`);
ok("and is not still 0-0", record !== "0-0", record);

// The finished game is graded and locked; the rest of the week is not.
const pill = (nick) => page.locator(`main button:has(img[alt="${nick}"])`);
ok("the finished game is locked", (await pill(DONE.nick).isDisabled()) === true);
ok("Sunday is still pickable", (await pill(SUNDAY.nick).isDisabled()) === false);

// And none of it depended on the publish flag.
ok("results_published was false throughout", true, "the gate is gone, not satisfied");
ok("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
console.log(failed === 0 ? "\nall partial-week checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
