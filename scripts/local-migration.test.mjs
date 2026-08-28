// Does this device's work actually reach the account it belongs to?
//
//   npm run dev                        (in one terminal)
//   node scripts/local-migration.test.mjs
//
// WHY THIS EXISTS. The migration is the one piece of this app that can
// destroy work rather than merely fail to save it, and the way it went
// wrong was silent on both ends: nothing errored, nothing looked odd, a
// season predictor just stopped existing.
//
// The bug: profiles.migrated_local_picks was set unconditionally, so the
// FIRST device to sign in claimed the account as migrated whether or not
// it brought anything with it. Sign up on a laptop, confirm the email on
// a phone, and the phone's empty run closes the door - the laptop holding
// the actual boards can never hand them over. The email confirmation flow
// makes that the normal path rather than an edge case.
//
// The fix has two halves, and both are load-bearing, so both are here:
//
//   1. The flag is only set once something was really brought across
//      (or once the account is too old to still be waiting on a first
//      device). An empty device must NOT claim the account.
//   2. The migration is additive - it reads the server first and leaves
//      any week the account already has alone. That is what makes (1)
//      safe: without it, a second run would delete and rewrite a week
//      from whatever stale copy the browser happened to hold.
//
// Assertions are on the REQUESTS, not on the screen, because "did it
// overwrite the account" has no appearance.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";
const USER = "11111111-1111-1111-1111-111111111111";
const SETTLE_MS = 6000;

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
const GUEST_WEEK = { "2026-w1-dal-phi": "DAL", "2026-w1-kc-lac": "KC" };

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "This test needs Playwright, which the project does not depend on.\n" +
      "  npx --yes playwright@latest install --with-deps chromium\n" +
      "  npm i --no-save playwright\n" +
      "then run it again. Set CHROME_PATH to a browser path if you have one already.",
  );
  process.exit(1);
}

try {
  const res = await fetch(APP, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.error(`No app at ${APP}. Start it with \`npm run dev\` first.`);
  process.exit(1);
}

const CASES = [
  {
    name: "a device carrying picks",
    local: { "pickem:picks:week-1": GUEST_WEEK },
    serverWeek: {},
    createdAt: daysAgo(0),
    wantInsert: true,
    wantFlag: true,
  },
  {
    // THE REGRESSION. The phone that confirmed the email has nothing on
    // it; it must not close the door on the laptop that does.
    name: "an empty device, new account",
    local: {},
    serverWeek: {},
    createdAt: daysAgo(0),
    wantInsert: false,
    wantFlag: false,
  },
  {
    // ...but not forever. The keys read here are also the signed-in
    // cache, so on a shared computer an indefinite window would become a
    // way to inherit a stranger's picks.
    name: "an empty device, old account",
    local: {},
    serverWeek: {},
    createdAt: daysAgo(30),
    wantInsert: false,
    wantFlag: true,
  },
  {
    // The account has been played signed in since, so the account is the
    // better copy. Nothing may be deleted or rewritten.
    name: "picks the account already has",
    local: { "pickem:picks:week-1": GUEST_WEEK },
    serverWeek: { "2026-w1-dal-phi": "PHI" },
    createdAt: daysAgo(0),
    wantInsert: false,
    wantFlag: false,
  },
];

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
let failures = 0;

for (const testCase of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const seen = { insert: 0, del: 0, flag: 0 };

  await ctx.route("**://posthog.invalid/**", (route) => route.abort());
  await ctx.route("**://*.posthog.com/**", (route) => route.abort());

  await ctx.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/weekly_picks")) {
      if (method === "POST") seen.insert++;
      if (method === "DELETE") seen.del++;
      if (method === "GET") {
        return json(
          Object.entries(testCase.serverWeek).map(([game_id, team_abbr]) => ({ game_id, team_abbr, is_lock: false })),
        );
      }
      return json([]);
    }

    if (url.includes("/profiles")) {
      if (method === "PATCH") {
        // Other things patch profiles too; only the migration flag counts.
        if ((req.postData() ?? "").includes("migrated_local_picks")) seen.flag++;
        return json([]);
      }
      const me = {
        id: USER, username: "dallas", display_name: "Dallas", avatar_url: null,
        is_admin: false, migrated_local_picks: false, referred_by: "claimed",
        onboarding_avatar_prompted: true, follow_recs_prompted: true,
        onboarding_referral_prompted: true, created_at: testCase.createdAt,
      };
      const wantsOne = (req.headers()["accept"] ?? "").includes("pgrst.object");
      return wantsOne ? json(me) : json([me]);
    }

    if (url.includes("/auth/v1/user")) return json({ id: USER, email: "d@example.com" });
    if (url.includes("/rpc/")) return json({});
    return json([]);
  });

  const page = await ctx.newPage();

  await page.addInitScript(
    ([key, id, local]) => {
      localStorage.setItem(key, JSON.stringify({
        access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        user: { id, aud: "authenticated", role: "authenticated", email: "d@example.com",
                app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
      }));
      for (const [k, v] of Object.entries(local)) localStorage.setItem(k, JSON.stringify(v));
    },
    ["sb-placeholder-auth-token", USER, testCase.local],
  );

  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(SETTLE_MS);

  const gotInsert = seen.insert > 0;
  const gotFlag = seen.flag > 0;
  // Nothing may be deleted unless something is being written in its place.
  const stomped = seen.del > 0 && !gotInsert;
  const ok = gotInsert === testCase.wantInsert && gotFlag === testCase.wantFlag && !stomped;
  if (!ok) failures++;

  console.log(
    `${ok ? "ok  " : "FAIL"} ${testCase.name.padEnd(30)} ` +
      `wrote:${String(gotInsert).padEnd(5)} want:${String(testCase.wantInsert).padEnd(5)} ` +
      `flag:${String(gotFlag).padEnd(5)} want:${String(testCase.wantFlag).padEnd(5)}` +
      `${stomped ? "  <- DELETED THE ACCOUNT'S WEEK" : ""}`,
  );
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall cases pass");
process.exit(failures ? 1 : 0);
