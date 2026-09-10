// What the board actually sends when it saves.
//
// Both of today's failures were invisible in the source and obvious in
// the request log. Delete-then-insert reads as one operation and is two
// round trips: when the insert was refused the delete had already
// committed and the board was empty, and when the device-copy restore and
// the autosave overlapped, each one's delete landed inside the other's
// gap and somebody got "Couldn't save your picks" on a save that was
// fine.
//
// So this test does not read the code. It intercepts every weekly_picks
// request the page makes and checks the one invariant that makes both of
// those impossible: NO DELETE MAY EVER NAME A GAME THE BOARD STILL HAS A
// PICK FOR. If that holds, no ordering and no interleaving can lose one,
// because there is no longer a moment when a pick is not in the table.
//
// The per-request assertions are what enforce that; the replay audit
// below is a weaker second opinion that only catches a delete landing
// after an upsert it should have respected. Restoring delete-then-insert
// gets past the audit and fails the assertions, which is the right way
// round - the audit cannot see inside a single save, and the whole
// problem lived inside a single save.
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
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(56)} ${detail}`);
  if (!cond) failed++;
}

const STARTED = { id: "2026-w1-ne-sea", nick: "Patriots", abbr: "NE" };
const SUN_A = { id: "2026-w1-tb-cin", nick: "Buccaneers", abbr: "TB" };
const SUN_B = { id: "2026-w1-no-det", nick: "Saints", abbr: "NO" };
// Forty minutes after the Wednesday opener, three days before Sunday.
const FROZEN = new Date("2026-09-09T21:00:00-04:00").getTime();

const browser = await playwright.chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// The account: the started game only. This is precisely the state a
// half-applied save leaves behind, and the state the device copy has to
// be read back into.
const account = new Map([[STARTED.id, { team: STARTED.abbr, is_lock: false }]]);
const sent = [];

// Playwright matches the LAST registered route first, so these are
// registered broadest to narrowest. The other way round, the catch-all
// swallows every weekly_picks write and this test passes by seeing
// nothing at all - which is how it failed for three runs.

// Weeks, results, friends: answered empty, so the week stays open and
// kickoff is the only thing that can lock a card.
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

// A profile with a username, or onboarding throws a full-screen modal
// over the board and every click below lands on its backdrop.
await page.route("**/rest/v1/profiles*", (r) =>
  r.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify([
      { id: "00000000-0000-4000-8000-00000000beef", username: "boardtest", display_name: "Board Test", avatar_url: null, is_admin: false, onboarded: true, migrated_local_picks: true },
    ]),
  }),
);

// The table under test: a real (if tiny) implementation, so the account's
// contents move exactly as the requests say they should.
await page.route("**/rest/v1/weekly_picks*", async (route) => {
  const req = route.request();
  const url = new URL(req.url());
  const method = req.method();
  const ids = (url.searchParams.get("game_id") ?? "").replace(/^in\.\(|\)$/g, "").split(",").filter(Boolean).map((s) => s.replace(/^"|"$/g, ""));
  let body = null;
  try {
    body = req.postDataJSON();
  } catch {
    body = null;
  }
  sent.push({ method, ids, body, prefer: req.headers()["prefer"] ?? "" });

  if (method === "GET") {
    const rows = [...account].map(([game_id, v]) => ({ game_id, team_abbr: v.team, is_lock: v.is_lock }));
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(rows) });
  }
  if (method === "DELETE") {
    for (const id of ids) account.delete(id);
    return route.fulfill({ status: 204, body: "" });
  }
  if (method === "POST") {
    for (const row of body ?? []) account.set(row.game_id, { team: row.team_abbr, is_lock: row.is_lock });
    return route.fulfill({ status: 201, contentType: "application/json", body: "[]" });
  }
  if (method === "PATCH") {
    for (const [id, v] of account) if (!ids.length || ids.includes(id)) account.set(id, { ...v, is_lock: false });
    return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
});
await page.addInitScript(
  ({ frozen, key, lockKey, authKey, picks }) => {
    const Real = Date;
    class Frozen extends Real {
      constructor(...a) {
        if (a.length === 0) super(frozen);
        else super(...a);
      }
      static now() {
        return frozen;
      }
    }
    globalThis.Date = Frozen;
    // A device that remembers the whole board, and an account that lost
    // most of it - the shape the restore has to cope with.
    localStorage.setItem(key, JSON.stringify(picks));
    localStorage.setItem(lockKey, "2026-w1-tb-cin");
    // Signed in, because none of the write paths exist for a signed-out
    // visitor. The SDK reads its session straight out of localStorage,
    // so a stored one is all it takes - and this environment's Supabase
    // URL is a placeholder, so nothing here is or needs a real account.
    // A well-formed (unsigned) JWT, because the SDK decodes the token it
    // finds in storage before it will hand back a session.
    const b64 = (o) => btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const jwt = [
      b64({ alg: "HS256", typ: "JWT" }),
      b64({ sub: "00000000-0000-4000-8000-00000000beef", aud: "authenticated", role: "authenticated", iss: "https://placeholder.supabase.co/auth/v1", iat: 1757462400, exp: 1893456000 }),
      "signature",
    ].join(".");
    localStorage.setItem(
      authKey,
      JSON.stringify({
        access_token: jwt,
        refresh_token: "test-refresh-token",
        token_type: "bearer",
        expires_in: 999999999,
        expires_at: Math.floor(new Date("2030-01-01T00:00:00Z").getTime() / 1000),
        user: { id: "00000000-0000-4000-8000-00000000beef", aud: "authenticated", role: "authenticated", email: "board@example.test", app_metadata: {}, user_metadata: {} },
      }),
    );
  },
  {
    frozen: FROZEN,
    key: "pickem:picks:week-1",
    lockKey: "pickem:lock:week-1",
    authKey: "sb-placeholder-auth-token",
    picks: { [STARTED.id]: STARTED.abbr, [SUN_A.id]: SUN_A.abbr, [SUN_B.id]: SUN_B.abbr },
  },
);
await page.route("**/auth/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));

await page.goto(`${BASE}/weekly`, { waitUntil: "networkidle" });
// Onboarding puts a full-screen overlay over the board for an account
// this stubbed session cannot fully satisfy. It is not what is under
// test, and its backdrop swallows every click, so it is taken out of the
// way rather than worked around. The save-error banner is a <p> in main,
// so it is unaffected.
await page.addStyleTag({ content: '[role="dialog"]{display:none !important}' });
await page.waitForTimeout(3000);

const pill = (nick) => page.locator(`main button:has(img[alt="${nick}"])`);
const banner = () => page.locator("main p.text-red-400");

// --- the invariant ----------------------------------------------------
// Replay every request in order against the account's contents at that
// moment, and check no DELETE ever names something still picked.
function auditDeletes() {
  const held = new Set([STARTED.id]);
  const offences = [];
  for (const r of sent) {
    if (r.method === "POST") for (const row of r.body ?? []) held.add(row.game_id);
    if (r.method === "DELETE") {
      for (const id of r.ids) {
        if (held.has(id)) offences.push(id);
        held.delete(id);
      }
    }
  }
  return offences;
}

const writes = sent.filter((r) => r.method !== "GET");
ok("the board saved on load", writes.length > 0, `${writes.length} writes`);
ok("no delete touched a live pick", auditDeletes().length === 0, auditDeletes().join(", "));
ok("writes are upserts", writes.filter((r) => r.method === "POST").every((r) => /merge-duplicates/.test(r.prefer)), writes.filter((r) => r.method === "POST").map((r) => r.prefer).join(" | "));
ok("no error shown to the user", (await banner().count()) === 0, (await banner().allTextContents()).join(" "));

// The restore itself landed.
ok("device copy reached the account", account.has(SUN_A.id) && account.has(SUN_B.id), [...account.keys()].join(", "));
ok("the played game was left alone", account.get(STARTED.id)?.team === STARTED.abbr);

// --- un-picking still removes the row ---------------------------------
// The reason the old code deleted the week at all: "save" means the board
// as it stands, including a game toggled back off.
sent.length = 0;
await pill(SUN_B.nick).click();
await page.waitForTimeout(2500);
const deletes = sent.filter((r) => r.method === "DELETE").flatMap((r) => r.ids);
ok("un-picking deletes that game", deletes.includes(SUN_B.id), `${deletes.length} named`);
// The delete names every open game with no pick, most of which have no
// row - a no-op each. What matters is not how short the list is but what
// it cannot contain: a game still picked, or a game already played.
ok("the still-picked game is spared", !deletes.includes(SUN_A.id));
ok("the played game is never named", !deletes.includes(STARTED.id));
ok("no delete touched a live pick", auditDeletes().length === 0);
ok("still no error shown", (await banner().count()) === 0, (await banner().allTextContents()).join(" "));

// --- two writers at once ----------------------------------------------
// Autosave and the restore can overlap, and used to collide. Firing a
// burst of edits inside one debounce window is the same shape.
sent.length = 0;
for (const t of [SUN_A, SUN_B, SUN_A, SUN_B]) {
  await pill(t.nick).click();
  await page.waitForTimeout(60);
}
await page.waitForTimeout(2500);
ok("no delete touched a live pick", auditDeletes().length === 0, auditDeletes().join(", "));
ok("rapid edits raise no error", (await banner().count()) === 0, (await banner().allTextContents()).join(" "));
ok("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
console.log(failed === 0 ? "\nall pick-save checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
