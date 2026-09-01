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
const freshContext = async (viewport = PHONE) => {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
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
await page.goto(`${APP}/nfl-nameplate`, { waitUntil: "domcontentloaded" });
// THE GUESS FIELD, not just any input in main. There is a second one
// now - a one-pixel keep-alive that PLAY AGAIN focuses to hold the tap
// gesture open while the real field mounts. It sits earlier in the DOM,
// so a bare "main input:not([data-keyboard-keepalive])" selector picks it instead: invisible, one pixel
// wide and pointer-events:none, which reads as the click being blocked
// by whatever is painted over it.
await page.waitForSelector("main input:not([data-keyboard-keepalive])", { timeout: 20000 });
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
await page.waitForSelector("main input:not([data-keyboard-keepalive])", { timeout: 20000 });
await page.waitForTimeout(900);

const field = page.locator("main input:not([data-keyboard-keepalive])").first();
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
// With the keyboard up but nothing guessed yet. The panel is already
// the size of the strip here - that is the point of engaging it with
// the keyboard rather than part-way through - so what this records is
// that engaging early did NOT cost the title and the mode toggle.
await page.waitForTimeout(500);
const atRest = await page.evaluate(() => ({
  pageY: Math.round(window.scrollY),
  shellUp: !!document.querySelector("[data-play-shell]"),
  chrome: (() => {
    const el = document.querySelector(".puzzle-chrome");
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  })(),
}));
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
    const input = document.querySelector("main input:not([data-keyboard-keepalive])");
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
      // Where the PAGE is. With the panel up nothing should move it -
      // the guesses scroll inside the box, not by dragging the document
      // around underneath a fixed element.
      pageY: Math.round(window.scrollY),
      // The title, the mode toggle and the round line: open, or
      // collapsed to nothing. Measured by height rather than by the
      // attribute, so a collapse that is only declared and not actually
      // happening reads as still open.
      chrome: (() => {
        const el = document.querySelector(".puzzle-chrome");
        if (!el) return null;
        return Math.round(el.getBoundingClientRect().height);
      })(),
      // Nothing animates the bar by transform any more, and a stray one
      // would offset it for the rest of the round. Kept as the guard
      // against that coming back.
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
// THE PANEL COMES UP WITH THE KEYBOARD, AND THE CHROME WAITS.
//
// It used to be the other way round: everything stayed in the page and
// the panel took over on the guess where the board outgrew the screen.
// That put a change of positioning scheme in the middle of play, and
// three rounds of fixes could not make that frame clean on a phone.
//
// So the panel engages when the keyboard opens - at the top of the
// page, nothing scrolling, no guess made - and what waits instead is
// the CHROME: the title, the mode toggle and the round line stay until
// the board is crowding its box, then collapse inside a panel that does
// not move. Same thing to look at, no switch to get wrong.
check(
  "the panel is up as soon as the keyboard is",
  atRest.shellUp,
  atRest.shellUp ? "engaged before the first guess" : "not engaged",
);
check(
  "and the title and toggle are still there",
  atRest.chrome !== null && atRest.chrome > 40,
  `chrome ${atRest.chrome}px tall with the keyboard up`,
);
const collapsed = report.findIndex((m) => m.chrome !== null && m.chrome < 4);
check(
  "the chrome collapses once the board crowds it",
  collapsed >= 0,
  collapsed < 0
    ? `never collapsed: ${report.map((m) => m.chrome).join(", ")}`
    : `open through guess ${collapsed}, collapsed from ${collapsed + 1}`,
);
check(
  "and stays collapsed",
  report.slice(collapsed).every((m) => m.chrome !== null && m.chrome < 4),
  `chrome px per guess: ${report.map((m) => m.chrome).join(", ")}`,
);
// THE PAGE DOES NOT MOVE DURING PLAY, AND THIS IS THE JUMP.
//
// Every version of the jump was the document being scrolled or
// re-laid-out under a panel that was supposed to be still: the page
// clamping when the card left the flow, the panel taking over before
// its scroll had run. None of that can happen if the page simply never
// moves once the panel is up - the guesses scroll inside the box.
check(
  "the page never moves once the panel is up",
  new Set([atRest.pageY, ...report.map((m) => m.pageY)]).size === 1,
  `scrollY: ${[atRest.pageY, ...report.map((m) => m.pageY)].join(", ")}`,
);
check(
  "and once up it matches the visible strip",
  report.every((m) => m.shellUp && m.shellHeight === VISIBLE_WITH_KEYBOARD),
  `heights: ${[...new Set(report.map((m) => m.shellHeight))].join(", ")} (strip is ${VISIBLE_WITH_KEYBOARD})`,
);
// It must not flicker back off - engaging frees the space that made it
// necessary, so a naive "does it fit now" would oscillate.
check(
  "no stray transform is left on the bar",
  report.every((m) => m.barTransform === "none" || m.barTransform === "matrix(1, 0, 0, 1, 0, 0)"),
  `transforms: ${[...new Set(report.map((m) => m.barTransform))].join(" | ")}`,
);
check(
  "and never flickers back off",
  report.every((m) => m.shellUp),
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

// AND THE SAME RUN ON A BIG PHONE, because whether the page can be
// yanked at all depends on how much of it is left under the card - and
// that is set by the LAYOUT viewport. The 390x800 above has room to
// spare and never clamps; the 440x956 in the recording did.
//
// Going fixed takes the card out of the document, so the document loses
// the card's whole height. The panel now engages at the top of the
// page, where there is no offset to lose, and the card leaves a hole
// the same height behind it - so the document does not shrink either.
// Both of those have to hold, and this is where they are checked.
const BIG_PHONE = { width: 440, height: 956 };
const BIG_VISIBLE = 560;
const bigCtx = await freshContext(BIG_PHONE);
const big = await bigCtx.newPage();
// A KEYBOARD THAT OPENS WHEN THE FIELD IS TAPPED, rather than one that
// was always there. The run above holds the strip short from the first
// frame, which means the panel engages on load with the page at the top
// - and at the top there is no scroll offset to lose, so the hole it
// leaves behind is never load-bearing. The case that needs it is the
// ordinary one: read some of the page, then tap the field.
await big.addInitScript((visible) => {
  let open = false;
  Object.defineProperty(window.visualViewport, "height", {
    get: () => (open ? visible : window.innerHeight),
    configurable: true,
  });
  Object.defineProperty(window.visualViewport, "offsetTop", { get: () => 0, configurable: true });
  window.__openKeyboard = () => {
    open = true;
    window.visualViewport.dispatchEvent(new Event("resize"));
  };
}, BIG_VISIBLE);
await big.addInitScript(() => {
  // Sampled every frame across the engage, because the clamp lands in
  // one frame and is gone by the next - reading before and after only
  // would miss it entirely.
  const snap = () => ({
    y: Math.round(window.scrollY),
    doc: document.documentElement.scrollHeight,
    max: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  });
  window.__engage = null;
  window.addEventListener("DOMContentLoaded", () => {
    let before = snap();
    let up = false;
    const tick = () => {
      const now = !!document.querySelector("[data-play-shell]");
      if (!up && now) {
        const at = snap();
        up = true;
        setTimeout(() => {
          window.__engage = { before, at, after: snap() };
        }, 700);
        return;
      }
      if (!now) before = snap();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
});
await big.goto(`${APP}/nfl-nameplate`, { waitUntil: "domcontentloaded" });
await big.waitForSelector("main input:not([data-keyboard-keepalive])", { timeout: 20000 });
await big.waitForTimeout(900);
await big.locator("main input:not([data-keyboard-keepalive])").first().click();
// A BOARD, AND THEN A SCROLL, AND ONLY THEN THE KEYBOARD. An empty
// board fits on the screen, so there is nothing to scroll and the
// switch has no offset it could lose - which is the one arrangement
// where the hole does not matter. Four guesses and a scroll to the
// bottom give it something to lose. That is the ordinary case anyway:
// come back to a round in progress, read down it, tap the field.
for (const seed of seeds) {
  await big.keyboard.type(seed);
  await big.waitForTimeout(340);
  await big.locator('[role="option"]').first().click();
  await big.waitForTimeout(700);
}
await big.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
await big.waitForTimeout(400);
const dropped = await big.evaluate(() => Math.round(window.scrollY));
await big.locator("main input:not([data-keyboard-keepalive])").first().click();
await big.evaluate(() => window.__openKeyboard());
await big.waitForTimeout(1400);
const e = await big.evaluate(() => window.__engage);
const bigRun = await big.evaluate(() => ({
  pageY: Math.round(window.scrollY),
  chrome: (() => {
    const el = document.querySelector(".puzzle-chrome");
    return el ? Math.round(el.getBoundingClientRect().height) : null;
  })(),
  rows: document.querySelectorAll("[data-guess-row]").length,
}));
check(
  "the card leaves a hole, so the document does not shrink",
  !!e && e.at.doc >= e.before.doc - 2,
  !e ? "panel never engaged" : `document ${e.before.doc} -> ${e.at.doc} across the switch`,
);
check(
  "and the scroll offset stays legal through it",
  !!e && e.at.max >= e.at.y && e.at.y === e.before.y && e.after.y === e.at.y,
  !e ? "panel never engaged" : `scrollY ${e.before.y} -> ${e.at.y} -> ${e.after.y}, max ${e.at.max}`,
);
check(
  "a board already too tall gets the chrome out of the way at once",
  !!e && bigRun.rows === 6 && bigRun.chrome !== null && bigRun.chrome < 4,
  `${bigRun.rows} rows, chrome ${bigRun.chrome}px, page scrolled to ${dropped} before the keyboard`,
);

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : "\nall checks pass");
process.exit(failed ? 1 : 0);
