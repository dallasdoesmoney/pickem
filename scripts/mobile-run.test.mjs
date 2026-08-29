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
// THE KEYBOARD IS SIMULATED BY SHRINKING visualViewport, not by using a
// short window - and that distinction is why this test missed a real bug
// once already.
//
// A short window makes innerHeight and visualViewport.height the same
// number, which is the one thing a keyboard never does. A keyboard
// leaves the LAYOUT viewport alone and covers part of it, so
// innerHeight stays tall while visualViewport.height shrinks. Everything
// hard about this lives in that gap: how far the page can scroll is set
// by the tall number, and what is visible is set by the short one.
//
// So the window is a full 390x800 phone and visualViewport.height is
// overridden to 430 - the real shape of the problem. What this still
// cannot prove is that iOS populates those properties the way every
// other browser does.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";

// A whole phone, and then the part of it a keyboard leaves.
const PHONE = { width: 390, height: 800 };
const VISIBLE_WITH_KEYBOARD = 430;

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
// A FRESH CONTEXT PER RUN, not a fresh tab. A guest's guesses live in
// localStorage, so a second tab in the same context opens onto a board
// that is already six deep and finished - every name greyed out.
const freshContext = async () => {
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
  return ctx;
};
const ctx = await freshContext();

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
// The keyboard, as the page sees one: visualViewport shrinks, the window
// does not, and a resize fires so the app can react.
await page.addInitScript((visible) => {
  Object.defineProperty(window.visualViewport, "height", { get: () => visible, configurable: true });
  Object.defineProperty(window.visualViewport, "offsetTop", { get: () => 0, configurable: true });
  window.addEventListener("load", () => {
    setTimeout(() => window.visualViewport.dispatchEvent(new Event("resize")), 60);
  });
}, VISIBLE_WITH_KEYBOARD);

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
    // The visible strip, NOT the window. This is the whole distinction.
    const vh = window.visualViewport.height;
    const input = document.querySelector("main input");
    // Both selectors, deliberately. data-guess-row is new; .puzzle-row
    // is what the board has always carried. Measuring only the new one
    // would make this test pass on the old code for the wrong reason -
    // it would find no rows and conclude nothing was off screen.
    const rowEls = [...document.querySelectorAll("[data-guess-row], .puzzle-row")];
    const newest = rowEls[rowEls.length - 1];
    const prev = rowEls[rowEls.length - 2];
    const box = (el) => (el ? el.getBoundingClientRect() : null);
    const bar = input ? input.closest("div[class*='flex-col']") : null;
    const barBox = box(bar);
    // The shell, when it is up: everything must be inside THIS, not
    // merely inside the window. Safari's own bottom chrome lives outside
    // the visual viewport too, which is why "in the window" was passing
    // on a phone where the row was plainly hidden.
    const shell = document.querySelector("[data-play-shell]");
    const shellBox = box(shell);
    // The scrolling box the rows live in once the shell is up. A row
    // clipped by this is a row you cannot read, however "in the window"
    // it technically is.
    const scrollBox = document.querySelector(".puzzle-board");
    const boxBox = box(scrollBox);
    const ir = box(input);
    const nr = box(newest);
    const pr = box(prev);
    return {
      rows: rowEls.length,
      focused: document.activeElement === input,
      // "On screen" means inside the visual viewport, not merely in the DOM.
      inputVisible: !!ir && ir.top >= 0 && ir.bottom <= vh,
      inputTop: ir ? Math.round(ir.top) : null,
      shellUp: !!shell,
      shellHeight: shellBox ? Math.round(shellBox.height) : null,
      newestVisible: !!nr && (shellBox ? nr.top >= shellBox.top - 1 && nr.bottom <= shellBox.bottom + 1 : nr.top >= 0 && nr.bottom <= vh),
      prevVisible: !!pr && (shellBox ? pr.bottom <= shellBox.bottom + 1 && pr.top >= shellBox.top - 1 : pr.bottom <= vh && pr.bottom > 0),
      vh: Math.round(vh),
      blurs: window.__blurs ?? 0,
      // A transform left behind by the hand-off animation would offset
      // the bar for the rest of the round - so by the time each guess
      // has settled, there must be none.
      barTransform: bar ? getComputedStyle(bar).transform : "none",
      // How far below the pinned field the newest row ends up. Big means
      // the scroll could not finish.
      // How far the newest row sits BELOW where the scroll aimed it.
      // Zero means it landed; a big number means the page ran out.
      belowTarget: nr ? Math.round(nr.bottom - (vh - 16)) : 0,
      // Is the older of the two visible rows tucked up behind the bar?
      // Reported from a phone, and the reason the scroll is capped.
      prevBehindBar: pr ? Math.round((boxBox ? boxBox.top : barBox ? barBox.bottom : 0) - pr.top) : 0,
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
// THE PANEL WAITS UNTIL IT IS NEEDED. Taking the page over on the first
// guess, while the board still fits, hides the title and the mode toggle
// for nothing. So the early guesses stay on the normal page and the
// panel arrives when the board outgrows the strip.
const firstShell = report.findIndex((m) => m.shellUp);
check(
  "the panel waits until the board outgrows the screen",
  firstShell > 0,
  firstShell < 0 ? "never engaged" : `normal page for ${firstShell} guess(es), panel from ${firstShell + 1}`,
);
check(
  "and once up it matches the visible strip",
  report.slice(firstShell).every((m) => m.shellUp && m.shellHeight === VISIBLE_WITH_KEYBOARD),
  `heights: ${[...new Set(report.slice(firstShell).map((m) => m.shellHeight))].join(", ")} (strip is ${VISIBLE_WITH_KEYBOARD})`,
);
// It must not flicker back off - engaging frees the space that made it
// necessary, so a naive "does it fit now" would oscillate.
check(
  "the hand-off animation leaves nothing behind",
  report.every((m) => m.barTransform === "none" || m.barTransform === "matrix(1, 0, 0, 1, 0, 0)"),
  `transforms: ${[...new Set(report.map((m) => m.barTransform))].join(" | ")}`,
);
check(
  "and never flickers back off",
  report.slice(firstShell).every((m) => m.shellUp),
  `shell per guess: ${report.map((m) => (m.shellUp ? "on" : "off")).join(" ")}`,
);
check("six guesses landed", report[report.length - 1].rows === 6, `${report[report.length - 1].rows} rows`);

// THE ONE THAT WAS FAILING ON A REAL PHONE. Scrolling correctly is no
// use if the page runs out of document underneath and the browser
// clamps the scroll - the newest row then stops short, halfway under
// the keyboard, which looks exactly like the scroll being too small.
//
// So: by the last guess the newest row must be sitting hard against the
// pinned field, not floating below where it could not reach.
// The measure is whether the scroll REACHED ITS TARGET. It aims to put
// the newest row's bottom 16px above the keyboard; if the document runs
// out underneath, the browser clamps and the row stops lower down -
// short of the line, partly behind the keyboard. So the distance from
// that line is the thing to check, and it has to hold on the LAST
// guesses, which are the ones with the least page left beneath them.
const shortfall = report.map((m) => m.belowTarget);
check(
  "the older of the two is not clipped at the top",
  report.slice(1).every((m) => m.prevBehindBar <= 8),
  `overlap px: ${report.slice(1).map((m) => m.prevBehindBar).join(", ")}`,
);
check(
  "the scroll reaches its target, not the end of the page",
  report.every((m) => m.belowTarget <= 24),
  `px short of the line, per guess: ${shortfall.join(", ")}`,
);

await page.screenshot({ path: "/tmp/claude-0/-home-user-pickem/c8c47499-bc03-5b0f-a459-d3a18c357eda/scratchpad/mobile-run.png" });

// THE JUMP, ON A SECOND PAGE WITH A DELIBERATELY LAZY SCROLL.
//
// The hand-off scrolls the page until the bar reaches the top of the
// strip and only then lets the panel take over, so that switching moves
// nothing. If it switches early the bar teleports - and that flash is
// what was visible on a real phone and invisible here.
//
// Invisible here because Chromium starts a smooth scroll almost
// immediately, so even a watcher that only looked for stillness happened
// to be right. iOS does not: the first frames of a smooth scroll sit
// still, which satisfied "three still frames" before the scroll began.
//
// So the shim below delays the scroll's FIRST MOVEMENT by 120ms, which
// is the whole difference between the two engines. Then the observable
// is where the page had scrolled to at the instant the panel appeared:
// if it is still sitting at the pre-scroll position, the switch is what
// moved the bar, and that is the jump.
const LAZY_MS = 120;
const jumpCtx = await freshContext();
const jump = await jumpCtx.newPage();
await jump.addInitScript((visible) => {
  Object.defineProperty(window.visualViewport, "height", { get: () => visible, configurable: true });
  Object.defineProperty(window.visualViewport, "offsetTop", { get: () => 0, configurable: true });
  window.addEventListener("load", () => {
    setTimeout(() => window.visualViewport.dispatchEvent(new Event("resize")), 60);
  });
}, VISIBLE_WITH_KEYBOARD);
await jump.addInitScript((lazy) => {
  const real = window.scrollBy.bind(window);
  window.scrollBy = (opts) => {
    if (opts && opts.behavior === "smooth") setTimeout(() => real(opts), lazy);
    else real(opts);
  };
}, LAZY_MS);
await jump.goto(`${APP}/daily`, { waitUntil: "domcontentloaded" });
await jump.waitForSelector("main input", { timeout: 20000 });
await jump.waitForTimeout(900);
await jump.locator("main input").first().click();
// Guess until the panel is one guess away, then watch that guess.
for (let i = 0; i < firstShell; i++) {
  await jump.keyboard.type(seeds[i]);
  await jump.waitForTimeout(340);
  await jump.locator('[role="option"]').first().click();
  await jump.waitForTimeout(1100);
}
await jump.keyboard.type(seeds[firstShell]);
await jump.waitForTimeout(340);
const handoff = jump.evaluate(
  () =>
    new Promise((done) => {
      const before = Math.round(window.scrollY);
      let at = null;
      const obs = new MutationObserver(() => {
        if (at === null && document.querySelector("[data-play-shell]")) {
          at = Math.round(window.scrollY);
          obs.disconnect();
        }
      });
      obs.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-play-shell"] });
      setTimeout(() => {
        obs.disconnect();
        done({ before, at, after: Math.round(window.scrollY) });
      }, 2600);
    }),
);
await jump.locator('[role="option"]').first().click();
const h = await handoff;
check(
  "the panel waits for the scroll, not just for frames",
  h.at !== null && h.after - h.before > 1 && Math.abs(h.at - h.after) <= 2,
  h.at === null
    ? "panel never engaged"
    : `scrollY ${h.before} -> ${h.at} at hand-off -> ${h.after} settled`,
);

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : "\nall checks pass");
process.exit(failed ? 1 : 0);
