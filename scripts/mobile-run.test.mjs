// Can you play a whole board on a phone without touching the screen
// between guesses?
//
//   npm run dev                  (in one terminal)
//   node scripts/mobile-run.test.mjs
//
// WHAT THIS IS ABOUT. On a phone the board outgrows the screen around the
// fourth guess, and the keyboard covers the bottom of it. Two things then
// go wrong at once: the field you type into scrolls off the top, and the
// row that just landed lands underneath the keyboard. The loop stops
// being type-enter-read and becomes scroll up, tap, type, enter, scroll
// down, read.
//
// So three things have to hold, every guess, with nothing tapped:
//
//   1. The field keeps focus, so the keyboard never closes.
//   2. The field stays on screen - it is sticky under the site chrome.
//   3. The newest row is visible, above where the keyboard would be.
//
// THE KEYBOARD IS SIMULATED BY A SHORT VIEWPORT, and that is a real
// limitation worth naming: a headless browser has no software keyboard,
// so visualViewport equals the layout viewport here. 390x430 is about
// what an iPhone leaves above the keyboard, so the geometry this asserts
// is the right geometry - what it cannot prove is that iOS reports it
// the way every other browser does.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";

// Roughly what an iPhone leaves visible with the keyboard up.
const KEYBOARD_OPEN = { width: 390, height: 430 };

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

const cell = (v, s = "miss") => ({ value: v, status: s });
const num = (v, s = "miss") => ({ value: v, status: s, direction: s === "miss" ? "up" : null });
const grade = (id) => ({
  espnId: id,
  name: `Player ${id}`,
  correct: false,
  team: cell("DET"),
  conference: cell("NFC", "hit"),
  division: cell("NFC North", "close"),
  position: cell("RB"),
  height: num(69, "close"),
  weight: num(202),
  age: num(24),
  jersey: num(0, "close"),
  college: { value: "Alabama", status: "miss", direction: null },
});

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const ctx = await browser.newContext({ viewport: KEYBOARD_OPEN, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
await page.goto(`${APP}/daily`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("main input", { timeout: 20000 });
await page.waitForTimeout(1000);

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(44)} ${detail}`);
};

// COUNTS BLURS, not focus-at-the-end, and the difference is the entire
// point. Chromium hands focus back after the await and looks fine;
// iOS closes the keyboard the instant the field blurs and will not
// reopen it for a programmatic focus outside the tap. So "is it focused
// now" passes on broken code. "Did it ever blur" does not.
await page.addInitScript(() => {
  window.__blurs = 0;
  document.addEventListener(
    "blur",
    (e) => {
      if (e.target instanceof HTMLInputElement) window.__blurs++;
    },
    true,
  );
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector("main input", { timeout: 20000 });
await page.waitForTimeout(900);

const field = page.locator("main input").first();
await field.click();

// HOW A GUESS IS MADE ON A PHONE. Not the Return key - a tap on the
// name in the dropdown. That distinction is the whole bug this test
// exists for: a button takes focus when tapped, which blurs the field
// and closes the keyboard, and no amount of focusing it again
// afterwards brings the keyboard back on iOS.
//
// So the run below TAPS, the way a phone does, rather than pressing
// Enter the way a keyboard does.
const seeds = ["ma", "jo", "ty", "br", "al", "ke"];
const report = [];
for (let i = 0; i < seeds.length; i++) {
  await page.keyboard.type(seeds[i]);
  await page.waitForTimeout(340);
  // Tap the first suggestion, which is what a thumb does.
  await page.locator('[role="option"]').first().click();
  // Long enough for the smooth scroll to land.
  await page.waitForTimeout(1100);

  const m = await page.evaluate(() => {
    const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const input = document.querySelector("main input");
    // Both selectors, deliberately. data-guess-row is new; .puzzle-row
    // is what the board has always carried. Measuring only the new one
    // would make this test pass on the old code for the wrong reason -
    // it would find no rows and conclude nothing was off screen.
    const rowEls = [...document.querySelectorAll("[data-guess-row], .puzzle-row")];
    const newest = rowEls[rowEls.length - 1];
    const prev = rowEls[rowEls.length - 2];
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    const ir = box(input);
    const nr = box(newest);
    const pr = box(prev);
    return {
      rows: rowEls.length,
      focused: document.activeElement === input,
      // "On screen" means inside the visual viewport, not merely in the DOM.
      inputVisible: !!ir && ir.top >= 0 && ir.bottom <= vh,
      inputTop: ir ? Math.round(ir.top) : null,
      newestVisible: !!nr && nr.top >= 0 && nr.bottom <= vh,
      prevVisible: !!pr && pr.bottom <= vh && pr.bottom > 0,
      vh: Math.round(vh),
      blurs: window.__blurs ?? 0,
    };
  });
  report.push(m);
}

const every = (fn) => report.every(fn);
check(
  "tapping a name never takes the focus",
  report[report.length - 1].blurs === 0 && every((m) => m.focused),
  `${report[report.length - 1].blurs} blur events over ${report.length} guesses`,
);
check(
  "the field stays on screen the whole run",
  every((m) => m.inputVisible),
  `tops: ${report.map((m) => m.inputTop).join(", ")}`,
);
check(
  "and it sticks rather than scrolling away",
  // Once the board is taller than the screen the field is pinned, so its
  // top stops moving. Same number every guess from the third on.
  new Set(report.slice(2).map((m) => m.inputTop)).size === 1,
  `pinned at ${report[report.length - 1].inputTop}px`,
);
check(
  "the newest guess is above the keyboard",
  every((m) => m.newestVisible),
  `${report.filter((m) => m.newestVisible).length}/${report.length} guesses`,
);
check(
  "and the one before it too, once there is one",
  report.slice(1).every((m) => m.prevVisible),
  `${report.slice(1).filter((m) => m.prevVisible).length}/${report.length - 1}`,
);
check("six guesses landed", report[report.length - 1].rows === 6, `${report[report.length - 1].rows} rows`);

await page.screenshot({ path: "/tmp/claude-0/-home-user-pickem/c8c47499-bc03-5b0f-a459-d3a18c357eda/scratchpad/mobile-run.png" });
await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : "\nall checks pass");
process.exit(failed ? 1 : 0);
