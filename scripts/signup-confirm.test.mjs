// Does signing up behave when the address has to be confirmed first?
//
//   npm run dev                        (in one terminal)
//   node scripts/signup-confirm.test.mjs
//
// WHY THIS EXISTS. Supabase decides whether a new account gets a session
// straight away; "Confirm email" is a checkbox in the dashboard, not
// anything in this repository. Turning it on changes what
// supabase.auth.signUp() hands back - a user and NO session - and the
// modal used to read only the error field, so a signup that had not
// finished looked exactly like one that had: no error, modal closes,
// caller goes to save the picks, nobody is signed in, the work is gone.
//
// That failure cannot happen locally by accident and cannot be caught by
// reading either file on its own, so it is tested here against the real
// component with the real supabase-js in between, and only the HTTP
// response swapped.
//
//   1. confirm ON   ->  no session comes back. The modal must STAY OPEN
//                       and say to check the inbox. Nothing may report
//                       a successful sign-in.
//   2. confirm OFF  ->  a session comes back. The modal must close and
//                       the app must be signed in, exactly as today.
//                       This is the regression half: the change must be
//                       invisible until the setting is flipped.
//   3. duplicate    ->  Supabase answers a signup on an existing address
//                       with no session and no error on purpose, so the
//                       box cannot be used to find out who has an
//                       account. Must land on the same "check your
//                       email" screen and say nothing more.
//
// Playwright is resolved at runtime rather than imported at the top, so
// it stays out of package.json the same way scripts/gen-og-cards.mjs
// keeps it out.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";
const USER = "11111111-1111-1111-1111-111111111111";
const EMAIL = "someone@example.com";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  // Same message as scripts/gen-og-cards.mjs, and for the same reason: a
  // bare "Cannot find module 'playwright'" stack sends you looking for a
  // broken install rather than an absent optional one.
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

const user = (email) => ({
  id: USER,
  aud: "authenticated",
  role: "authenticated",
  email,
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: new Date().toISOString(),
});

const session = (email) => ({
  access_token: "fake",
  refresh_token: "fake",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: user(email),
});

// The three shapes /auth/v1/signup actually returns, copied from the
// wire rather than invented. The confirm-on and duplicate bodies differ
// only in fields this code never looks at, which is the point of testing
// both: they must reach the same screen.
const CASES = [
  {
    name: "confirm email ON",
    // No session key at all. supabase-js reads this as { user, session: null }.
    body: () => ({ ...user(EMAIL), identities: [{ id: USER }] }),
    wantOpen: true,
    wantSignedIn: false,
  },
  {
    name: "confirm email OFF",
    body: () => ({ ...session(EMAIL), user: user(EMAIL) }),
    wantOpen: false,
    wantSignedIn: true,
  },
  {
    name: "address already has an account",
    // identities is EMPTY - that is Supabase's obfuscated answer, and it
    // is deliberately indistinguishable from a fresh signup here.
    body: () => ({ ...user(EMAIL), identities: [] }),
    wantOpen: true,
    wantSignedIn: false,
  },
  {
    // The case this was all for: the link is opened somewhere else
    // entirely, and THIS browser - the one holding the picks - has to
    // notice and let itself in. Nothing tells it; it asks, so the test
    // has to wait a poll interval to see it happen.
    name: "confirmed on another device",
    body: () => ({ ...user(EMAIL), identities: [{ id: USER }] }),
    confirmed: true,
    waitMs: 25_000,
    wantOpen: false,
    wantSignedIn: true,
  },
];

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
let failures = 0;

for (const testCase of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let tokenCalls = 0;

  await ctx.route(`${SB}/**`, (route) => {
    const url = route.request().url();
    const json = (body, status = 200) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.includes("/auth/v1/signup")) return json(testCase.body());
    // Sign-in, which is what the wait on the confirmation screen retries.
    // Refused exactly the way Supabase refuses it until the address is
    // proved - so a case that never confirms also proves the retry does
    // not talk itself into a false success.
    if (url.includes("/auth/v1/token")) {
      tokenCalls++;
      return testCase.confirmed
        ? json({ ...session(EMAIL), user: user(EMAIL) })
        : json({ error: "invalid_grant", error_description: "Email not confirmed" }, 400);
    }
    if (url.includes("/auth/v1/user")) return json(user(EMAIL));
    if (url.includes("/profiles")) {
      const me = {
        id: USER, username: "dallas", display_name: "Dallas", referred_by: null,
        migrated_local_picks: true, avatar_url: null, is_admin: false,
      };
      // .single() asks for an OBJECT and PostgREST switches on this
      // header; handing it an array makes supabase-js error and the
      // profile never loads.
      const wantsOne = (route.request().headers()["accept"] ?? "").includes("pgrst.object");
      return wantsOne ? json(me) : json([me]);
    }
    if (url.includes("/rpc/")) return json({});
    return json([]);
  });

  const page = await ctx.newPage();
  // Analytics is not what is under test, and letting it retry forever
  // means the page never goes idle.
  await ctx.route("**://*.posthog.com/**", (route) => route.abort());
  await ctx.route("**://posthog.invalid/**", (route) => route.abort());
  await page.goto(`${APP}/account`, { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "SIGN IN", exact: true }).first().click();
  await page.getByRole("button", { name: "Need an account? Sign up" }).click();
  await page.getByPlaceholder("Email").fill(EMAIL);
  await page.getByPlaceholder("Password", { exact: true }).fill("hunter2hunter2");
  await page.getByPlaceholder("Password again").fill("hunter2hunter2");
  await page.getByRole("button", { name: "SIGN UP" }).click();

  // Long enough for the modal to close on the success path, and for a
  // session that did arrive to reach the rest of the app. A case that is
  // waiting on the confirmation retry needs a poll interval instead.
  await page.waitForTimeout(testCase.waitMs ?? 2500);

  // Narrowed to THIS dialog by its own heading, not just "a dialog is
  // open" - signing in successfully hands straight over to the add-a-
  // photo prompt, which is also a dialog, and matching that one made a
  // clean pass look like a failure.
  const signIn = page.getByRole("dialog").filter({ hasText: /CREATE ACCOUNT|CHECK YOUR EMAIL/ });
  const open = await signIn.isVisible().catch(() => false);
  const text = open ? ((await signIn.textContent()) ?? "").replace(/\s+/g, " ") : "";
  const says = /Check your email/i.test(text) && text.includes(EMAIL);
  // Read from the page rather than from the modal: "signed in" means the
  // app believes it, not that a dialog closed.
  const signedIn = await page.evaluate(
    (key) => Boolean(localStorage.getItem(key)),
    "sb-placeholder-auth-token",
  );

  const ok =
    open === testCase.wantOpen &&
    signedIn === testCase.wantSignedIn &&
    (testCase.wantOpen ? says : true) &&
    // A case that got in by waiting must actually have asked. Landing
    // here without a single retry would mean it passed for some other
    // reason and the wait is not being tested at all.
    (testCase.confirmed ? tokenCalls > 0 : true) &&
    // The duplicate case must not volunteer anything the fresh one does not.
    (testCase.name.includes("already") ? !/already|exists|taken/i.test(text) : true);

  if (!ok) failures++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${testCase.name.padEnd(30)} ` +
      `modal:${(open ? "open" : "closed").padEnd(6)} want:${(testCase.wantOpen ? "open" : "closed").padEnd(6)} ` +
      `signedIn:${String(signedIn).padEnd(5)} want:${String(testCase.wantSignedIn).padEnd(5)} ` +
      `retries:${String(tokenCalls).padEnd(3)} ` +
      `${text.slice(0, 60)}`,
  );
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} FAILED` : "\nall cases pass");
process.exit(failures ? 1 : 0);
