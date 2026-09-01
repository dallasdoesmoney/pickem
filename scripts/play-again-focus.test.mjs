// Does PLAY AGAIN leave you typing?
//
//   npm run dev              (in one terminal)
//   node scripts/play-again-focus.test.mjs
//
// WHAT IS HARD ABOUT THIS. The guess field does not exist when PLAY
// AGAIN is pressed - a finished round replaces it with the result
// buttons - so it cannot be focused in the click handler. It mounts on
// the render the tap causes, and on iOS that is one tick too late: a
// keyboard opens for a focus() with a finger behind it and for nothing
// else.
//
// So the tap focuses a one-pixel field first, and the caret is handed to
// the real one the moment it mounts. What this test can check is the
// chain: that the tap lands on the keep-alive, that the caret ends up in
// the real field, and that you can type into it without touching it.
//
// WHAT IT CANNOT CHECK is whether iOS actually raises the keyboard.
// Headless Chromium has no software keyboard, so "focused" is the whole
// of what is observable here. That has been the difference between a
// passing test and a working phone twice in this component already.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("This test needs Playwright. npm i --no-save playwright, then run it again.");
  process.exit(1);
}
try {
  const res = await fetch(APP, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(String(res.status));
} catch {
  console.error(`No app at ${APP}. Start it with \`npm run dev\` first.`);
  process.exit(1);
}

const cell = (v, s = "miss") => ({ value: v, status: s });
const num = (v, s = "miss") => ({ value: v, status: s, direction: s === "miss" ? "up" : null });
// Every guess wrong, so a round ends by running out rather than by
// solving - no celebration to wait through, and the same result dialog.
const grade = (id) => ({
  espnId: id, name: `Player ${id}`, correct: false, team: cell("DET"),
  conference: cell("NFC", "hit"), division: cell("NFC North", "close"), position: cell("RB"),
  height: num(69, "close"), weight: num(202), age: num(24), jersey: num(0, "close"),
  college: { value: "Alabama", status: "miss", direction: null },
});

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass });
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(46)} ${detail}`);
};

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);

// Both, because the ask was for both - and they fail differently. A
// desktop only needs the caret; a phone needs the caret AND the gesture
// that raises a keyboard around it.
for (const shape of [
  { label: "desktop", viewport: { width: 1280, height: 900 }, touch: false },
  { label: "phone", viewport: { width: 440, height: 956 }, touch: true },
]) {
  const ctx = await browser.newContext({
    viewport: shape.viewport,
    deviceScaleFactor: 1,
    isMobile: shape.touch,
    hasTouch: shape.touch,
  });
  await ctx.route("**://posthog.invalid/**", (r) => r.abort());
  await ctx.route("**://*.posthog.com/**", (r) => r.abort());
  await ctx.route(`${SB}/**`, (route) => {
    const u = route.request().url();
    let post = {};
    try {
      post = JSON.parse(route.request().postData() ?? "{}");
    } catch {}
    const j = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    if (u.includes("puzzle_practice_compare")) return j(grade(post.p_guess));
    if (u.includes("puzzle_guest_compare")) return j(grade(post.p_espn_id));
    if (u.includes("/rpc/")) return j({});
    return j([]);
  });

  const page = await ctx.newPage();
  // Records what the keep-alive field is FOR: that the tap reaches it
  // while it is still a tap. Without this the test could pass on a
  // version that only focuses the real field a tick later - which is
  // exactly the version iOS refuses to open a keyboard for.
  await page.addInitScript(() => {
    window.__keepAliveFocused = 0;
    document.addEventListener(
      "focusin",
      (e) => {
        if (e.target instanceof HTMLElement && e.target.hasAttribute("data-keyboard-keepalive")) {
          window.__keepAliveFocused++;
        }
      },
      true,
    );
  });
  await page.goto(`${APP}/nfl-nameplate`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("main input:not([data-keyboard-keepalive])", { timeout: 20000 });
  await page.waitForTimeout(900);

  const field = page.locator("main input:not([data-keyboard-keepalive])").first();
  await page.getByRole("button", { name: "UNLIMITED" }).first().click();
  await page.waitForTimeout(700);

  // Run a round out. Eight wrong guesses ends it with the result dialog.
  const seeds = ["ma", "jo", "ty", "br", "al", "ke", "da", "ca"];
  await field.click();
  for (const seed of seeds) {
    await page.keyboard.type(seed);
    await page.waitForTimeout(320);
    const option = page.locator('[role="option"]:not([disabled])').first();
    if ((await option.count()) === 0) break;
    await option.click();
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(900);

  const dialog = page.locator('[role="dialog"]').first();
  const dialogUp = await dialog.isVisible().catch(() => false);
  check(`${shape.label}: the round ends with the result dialog`, dialogUp);
  if (!dialogUp) {
    await ctx.close();
    continue;
  }

  // Everything below is about this one tap. Nothing else is touched
  // afterwards - no click into the field, which is the whole request.
  const before = await page.evaluate(() => window.__keepAliveFocused ?? 0);
  await dialog.getByRole("button", { name: "PLAY AGAIN" }).click();
  await page.waitForTimeout(500);

  const m = await page.evaluate(() => {
    const real = document.querySelector("main input:not([data-keyboard-keepalive])");
    const active = document.activeElement;
    return {
      keepAlive: window.__keepAliveFocused ?? 0,
      fieldExists: !!real,
      // The caret has to be in the REAL field, not still parked on the
      // keep-alive - a keyboard attached to an invisible input is worse
      // than no keyboard at all.
      caretInField: !!real && active === real,
      onKeepAlive: !!(active instanceof HTMLElement) && active.hasAttribute("data-keyboard-keepalive"),
      rows: document.querySelectorAll("[data-guess-row]").length,
    };
  });

  check(`${shape.label}: the tap reaches the keep-alive field`, m.keepAlive > before, `${before} -> ${m.keepAlive}`);
  check(`${shape.label}: a fresh board is dealt`, m.fieldExists && m.rows === 0, `${m.rows} rows`);
  check(`${shape.label}: the caret ends up in the guess field`, m.caretInField);
  check(`${shape.label}: and is not left on the keep-alive`, !m.onKeepAlive);

  // The proof, rather than the proxy: type without touching anything.
  await page.keyboard.type("ma");
  await page.waitForTimeout(400);
  const typed = await page.evaluate(() => {
    const real = document.querySelector("main input:not([data-keyboard-keepalive])");
    return { value: real ? real.value : null, options: document.querySelectorAll('[role="option"]').length };
  });
  check(
    `${shape.label}: you can type straight away, untouched`,
    typed.value === "ma" && typed.options > 0,
    `field "${typed.value}", ${typed.options} suggestions`,
  );

  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : "\nall checks pass");
process.exit(failed ? 1 : 0);
