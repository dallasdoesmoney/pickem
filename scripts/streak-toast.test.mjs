// Does the daily check-in actually announce itself?
//
//   npm run dev                       (in one terminal)
//   node scripts/streak-toast.test.mjs
//
// WHY THIS IS A BROWSER TEST AND NOT A UNIT TEST. The bug it exists to
// catch was not in any function. Every piece worked: daily_check_in()
// returned the right thing, checkInRow() built the right toast, the
// queue played it. What was wrong was the ORDER OF RENDERS - useAuth
// delivers `user` on one render and `profile` on a later one, the
// notifications effect was keyed on both, so it ran twice, and the two
// runs fought over something that can only happen once a day:
//
//   call #1  awarded:true   <- won it, then discarded as cancelled
//   call #2  awarded:false  <- the day was already claimed
//
// Nothing appeared. The points still landed and the streak still counted
// up, so the only broken part was the announcement - which is exactly
// the kind of failure that looks like the feature was never built.
//
// Nothing short of mounting the real component against a real React
// render cycle would have caught that, so this drives the running app in
// a browser with every Supabase call intercepted. It talks to nothing,
// needs no account, and writes nothing.
//
// The two assertions that matter, in order of importance:
//   1. daily_check_in is called EXACTLY ONCE per load. Twice means the
//      claim is being raced again, whatever ends up on screen.
//   2. The right surface appears at all - watched over time rather than
//      sampled, because a toast removes itself after five seconds and
//      "is it there now" answers a different question depending on when
//      you ask.
//
// Playwright is resolved at runtime rather than imported at the top, so
// it stays out of package.json the same way scripts/gen-og-cards.mjs
// keeps it out.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";
const USER = "11111111-1111-1111-1111-111111111111";
const FOLLOWER = "33333333-3333-3333-3333-333333333333";
const SETTLE_MS = 9000;

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  // Same message as scripts/gen-og-cards.mjs, and for the same reason:
  // a bare "Cannot find module 'playwright'" stack sends you looking for
  // a broken install rather than an absent optional one.
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

const follower = () => ({
  id: "n1",
  type: "new_follower",
  data: { follower_id: FOLLOWER },
  created_at: new Date().toISOString(),
});

const CASES = [
  { name: "streak 5 - the toast", want: "toast",
    checkIn: { awarded: true, points: 50, streak: 5, longest: 9 }, notifs: [] },
  { name: "streak 1 - the pop-up", want: "modal",
    checkIn: { awarded: true, points: 50, streak: 1, longest: 3 }, notifs: [] },
  { name: "already claimed today", want: "nothing",
    checkIn: { awarded: false, points: 0, streak: 5, longest: 9 }, notifs: [] },
  { name: "the RPC fails", want: "nothing", checkIn: "ERROR", notifs: [] },
  { name: "check-in AND a follower", want: "toast",
    checkIn: { awarded: true, points: 50, streak: 5, longest: 9 }, notifs: [follower()] },
  { name: "a follower, no check-in", want: "toast",
    checkIn: { awarded: false, points: 0, streak: 5, longest: 9 }, notifs: [follower()] },
];

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
let failures = 0;

for (const testCase of CASES) {
  const want = testCase.want;
  let checkInCalls = 0;
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await ctx.route(`${SB}/**`, (route) => {
    const url = route.request().url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/rpc/daily_check_in")) {
      checkInCalls++;
      if (testCase.checkIn === "ERROR") return json({ message: "boom" }, 500);
      // The once-a-day rule, exactly as the database enforces it: only
      // the first caller can win the award. This is what turns a second
      // call from harmless into a lost notification.
      return json(checkInCalls === 1 ? testCase.checkIn : { ...testCase.checkIn, awarded: false });
    }
    if (url.includes("/rpc/")) return json({});
    if (url.includes("/auth/v1/user")) return json({ id: USER, email: "d@example.com" });
    if (url.includes("/notifications")) return json(testCase.notifs);
    if (url.includes("/profiles")) {
      const me = { id: USER, username: "dallas", display_name: "Dallas", referred_by: null,
                   migrated_local_picks: true, avatar_url: null, is_admin: false };
      const them = { id: FOLLOWER, username: "sam", display_name: "Sam", avatar_url: null };
      // .single() asks for an OBJECT, and PostgREST switches on this
      // header. Handing it an array makes supabase-js error, the profile
      // never loads, and the second render this test is about never
      // happens - so the test would pass against the broken code.
      const wantsOne = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
      if (wantsOne) return json(me);
      return json(url.includes(FOLLOWER) ? [them] : [me, them]);
    }
    return json([]);
  });

  const page = await ctx.newPage();

  // A session in localStorage is what makes useAuth report a signed-in
  // user without a real login round-trip.
  await page.addInitScript(([key, id]) => {
    localStorage.setItem(key, JSON.stringify({
      access_token: "fake", refresh_token: "fake", token_type: "bearer", expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: { id, aud: "authenticated", role: "authenticated", email: "d@example.com",
              app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    }));
  }, ["sb-placeholder-auth-token", USER]);

  // Record everything that appears, rather than looking once at the end.
  await page.addInitScript(() => {
    window.__seen = [];
    setInterval(() => {
      const toast = document.querySelector(".toast-card");
      if (toast) {
        const text = toast.textContent.replace(/\s+/g, " ").trim();
        if (!window.__seen.some((s) => s.kind === "toast" && s.text === text))
          window.__seen.push({ kind: "toast", text });
      }
      const modal = [...document.querySelectorAll("div")].some(
        (el) => /day streak|STREAK/i.test(el.textContent ?? "") && String(el.className).includes("fixed"));
      if (modal && !window.__seen.some((s) => s.kind === "modal"))
        window.__seen.push({ kind: "modal", text: "" });
    }, 120);
  });

  await page.goto(APP, { waitUntil: "networkidle" });
  await page.waitForTimeout(SETTLE_MS);

  const seen = await page.evaluate(() => window.__seen ?? []);
  const got = seen.find((s) => s.kind === want) ?? seen[0] ?? { kind: "nothing", text: "" };
  const onceOnly = checkInCalls === 1;
  const ok = got.kind === want && onceOnly;
  if (!ok) failures++;

  console.log(
    `${ok ? "ok  " : "FAIL"} ${testCase.name.padEnd(24)} ` +
      `daily_check_in x${checkInCalls}${onceOnly ? "" : " <- RACED"}  ` +
      `got:${got.kind.padEnd(8)} want:${want.padEnd(8)} ${got.text.slice(0, 44)}`,
  );
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall cases pass");
process.exit(failures ? 1 : 0);
