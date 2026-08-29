// Does unlimited mode play, and does the daily survive it?
//
//   npm run dev                     (in one terminal)
//   node scripts/unlimited-mode.test.mjs
//
// WHY A BROWSER TEST. The risk in this feature is not the grading - that
// is one SQL function shared with the daily, and it is tested where it
// lives. The risk is the two boards: the component now holds a daily
// board and a practice board at once, and every way that goes wrong is a
// state bug that only exists once React is running.
//
// The four that would actually hurt:
//
//   1. The daily gets clobbered. Switching to unlimited and back has to
//      return the day's board exactly as it was left - a guest's run in
//      particular exists nowhere else, so losing it loses it for good.
//   2. Practice guesses land on the daily. The two share one guess
//      handler; if the wrong branch runs, a practice guess is spent
//      against today's player, which cannot be given back.
//   3. PLAY AGAIN does not deal a new player. A "new round" that keeps
//      the old answer is the whole feature failing quietly.
//   4. The daily's payout leaks into practice. Nothing here may be
//      recorded or paid.
//
// Supabase is intercepted, so this talks to nothing and writes nothing.
const APP = process.env.APP_URL ?? "http://localhost:3000";
const SB = "https://placeholder.supabase.co";

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

// A graded guess in the server's shape. Every cell a miss unless the
// guess IS the answer, which is all this test needs - what a yellow
// means is settled in SQL, not here.
const cell = (value, status = "miss") => ({ value, status });
const num = (value, status = "miss") => ({ value, status, direction: null });
const grade = (guessId, answerId) => ({
  espnId: guessId,
  name: `Player ${guessId}`,
  correct: guessId === answerId,
  team: cell("KC", guessId === answerId ? "hit" : "miss"),
  conference: cell("AFC", guessId === answerId ? "hit" : "miss"),
  division: cell("AFC West", guessId === answerId ? "hit" : "miss"),
  position: cell("QB", guessId === answerId ? "hit" : "miss"),
  height: num(75, guessId === answerId ? "hit" : "miss"),
  weight: num(220, guessId === answerId ? "hit" : "miss"),
  age: num(28, guessId === answerId ? "hit" : "miss"),
  jersey: num(15, guessId === answerId ? "hit" : "miss"),
  college: { value: "Texas Tech", status: guessId === answerId ? "hit" : "miss", direction: null },
});

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });

// Every practice answer the page asks to be graded against, in order.
const practiceAnswers = [];
let dailyGuesses = 0;
// Flipped on for the win case: the next graded guess comes back correct
// whoever it was, so a solve can be forced without knowing the answer.
let forceCorrect = false;

await ctx.route("**://posthog.invalid/**", (r) => r.abort());
await ctx.route("**://*.posthog.com/**", (r) => r.abort());
await ctx.route(`${SB}/**`, async (route) => {
  const req = route.request();
  const url = req.url();
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  const post = (() => {
    try {
      return JSON.parse(req.postData() ?? "{}");
    } catch {
      return {};
    }
  })();

  if (url.includes("/rpc/puzzle_practice_compare")) {
    practiceAnswers.push(post.p_answer);
    return json(grade(post.p_guess, forceCorrect ? post.p_guess : post.p_answer));
  }
  if (url.includes("/rpc/puzzle_guest_compare")) {
    dailyGuesses++;
    return json(grade(post.p_espn_id, "daily-answer"));
  }
  if (url.includes("/rpc/")) return json({});
  return json([]);
});

const page = await ctx.newPage();
await page.goto(`${APP}/daily`, { waitUntil: "domcontentloaded" });
await page.waitForSelector('input[placeholder]', { timeout: 20000 });
await page.waitForTimeout(1200);

const field = page.locator('main input').first();

// Types a name and takes the first suggestion.
async function guessSomething(text) {
  await field.click();
  await field.fill(text);
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
}

const rows = () => page.locator('main [data-guess-row], main [class*="puzzle-row"]').count();

const results = [];
const check = (name, pass, detail = "") => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "ok  " : "FAIL"} ${name.padEnd(46)} ${detail}`);
};

// --- 1. Two guesses on the daily, so there is something to preserve ---
await guessSomething("a");
await guessSomething("b");
const dailyRowsBefore = await rows();
check("the daily takes guesses", dailyRowsBefore >= 2, `${dailyRowsBefore} rows, ${dailyGuesses} graded`);

// --- 2. Switch to unlimited ---
await page.getByRole("button", { name: "UNLIMITED" }).click();
await page.waitForTimeout(700);
const emptied = await rows();
// WHICH ROUND, wherever it is written. It used to be a caption under
// the toggle reading "Round 1 · no points, no streak"; it is the strip
// across the top of the card now, reading "ROUND 1 · NO STREAK". The
// same fact in the same place on the screen, so the test asks for the
// fact and not for the sentence - case-insensitively, since the strip
// is set in caps.
const roundIs = async (n) => (await page.locator(`text=/round ${n}/i`).count()) > 0;
const roundLine = await roundIs(1);
check("unlimited starts a fresh board", emptied === 0 && roundLine, `${emptied} rows, round line ${roundLine}`);

// --- 3. A practice guess must not touch the daily ---
const dailyGuessesBefore = dailyGuesses;
await guessSomething("c");
check(
  "a practice guess is graded as practice",
  practiceAnswers.length === 1 && dailyGuesses === dailyGuessesBefore,
  `practice ${practiceAnswers.length}, daily unchanged at ${dailyGuesses}`,
);

// --- 4. Back to the daily: the run has to still be there ---
await page.getByRole("button", { name: "TODAY" }).click();
await page.waitForTimeout(700);
const dailyRowsAfter = await rows();
check(
  "the daily board survives the round trip",
  dailyRowsAfter === dailyRowsBefore,
  `${dailyRowsAfter} rows, was ${dailyRowsBefore}`,
);

// --- 5. And the practice round is still where it was left ---
await page.getByRole("button", { name: "UNLIMITED" }).click();
await page.waitForTimeout(700);
const practiceRows = await rows();
const stillRoundOne = await roundIs(1);
check(
  "the practice round survives it too",
  practiceRows === 1 && stillRoundOne,
  `${practiceRows} rows, still round 1 ${stillRoundOne}`,
);

// --- 5b. The caret has to survive a guess ---
//
// It did not. The field was disabled while a guess graded, which blurs a
// focused element, and the focus() meant to restore it ran while `busy`
// was still true - a no-op on an element that cannot take focus. Every
// guess ended with the caret nowhere and the next one needed a click. On
// a phone it was worse: disabling dismisses the keyboard, and iOS will
// not reopen it for a programmatic focus after an await.
{
  await field.click();
  await field.fill("br");
  await page.waitForTimeout(350);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(700);
  const focused = await page.evaluate(() => document.activeElement?.tagName === "INPUT");
  check("the field keeps focus after Enter", focused, focused ? "" : "caret left the box");

  // And the proof it is usable: type without touching anything.
  await page.keyboard.type("ma");
  await page.waitForTimeout(300);
  const typed = await field.inputValue();
  check("you can keep typing straight away", typed === "ma", `field holds "${typed}"`);
  await field.fill("");
}

// --- 6. Play out the round and check PLAY AGAIN deals a new player ---
for (let i = 0; i < 8 && !(await page.getByRole("button", { name: "PLAY AGAIN" }).count()); i++) {
  await guessSomething(String.fromCharCode(100 + i));
}
const firstAnswer = practiceAnswers[0];
const finished = (await page.getByRole("button", { name: "PLAY AGAIN" }).count()) > 0;
check("a lost round ends and offers another", finished, `after ${practiceAnswers.length} guesses`);

if (finished) {
  // THE RESULT IS A DIALOG NOW. It has to be dismissible, the board has
  // to still be there underneath, and there has to be a way back to it -
  // a result you lose by closing it takes the daily's share button with
  // it.
  const dialog = page.getByRole("dialog", { name: "Result" });
  check("the result arrives as a dialog", await dialog.isVisible().catch(() => false));
  check("the board is still behind it", (await rows()) > 0, `${await rows()} rows`);

  await page.getByRole("button", { name: "Close result" }).click();
  await page.waitForTimeout(400);
  check("it closes", !(await dialog.isVisible().catch(() => false)));

  await page.getByRole("button", { name: "SEE RESULT" }).click();
  await page.waitForTimeout(400);
  check("and can be reopened", await dialog.isVisible().catch(() => false));

  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("escape closes it too", !(await dialog.isVisible().catch(() => false)));

  await page.getByRole("button", { name: "SEE RESULT" }).click();
  await page.waitForTimeout(400);

  // The answer is revealed on a LOSS, which the daily deliberately never
  // does for a guest - here the browser already knows it and being told
  // is the point of practising.
  const revealed = (await page.locator("text=/Out of guesses/").count()) > 0;
  check("a lost practice round still reveals the player", revealed);

  const shareOffered = (await page.getByRole("button", { name: /SHARE RESULT/ }).count()) > 0;
  check("practice is not shareable", !shareOffered, "no SHARE RESULT button");

  await dialog.getByRole("button", { name: "PLAY AGAIN" }).click();
  await page.waitForTimeout(700);
  check("PLAY AGAIN closes the dialog", !(await dialog.isVisible().catch(() => false)));
  const roundTwo = await roundIs(2);
  const clean = (await rows()) === 0;
  check("PLAY AGAIN starts round 2 with a clean board", roundTwo && clean, `round 2 ${roundTwo}, ${await rows()} rows`);

  await guessSomething("z");
  const secondAnswer = practiceAnswers[practiceAnswers.length - 1];
  check("and a different player", secondAnswer !== firstAnswer, `${firstAnswer} then ${secondAnswer}`);
}

// --- 7. THE WIN. The celebration has to play out in full and THEN hand
//        over to the dialog - the flips are the payoff, and a result card
//        landing on top of them throws it away.
{
  forceCorrect = true;
  await guessSomething("ty");

  // Straight after the guess: board celebrating, dialog not yet up.
  const dialog = page.getByRole("dialog", { name: "Result" });
  const celebratingNow = await page.locator('[data-celebrate="1"]').count();
  const dialogEarly = await dialog.isVisible().catch(() => false);
  check(
    "a solve celebrates before it reports",
    celebratingNow > 0 && !dialogEarly,
    `celebrating ${celebratingNow > 0}, dialog up ${dialogEarly}`,
  );

  // CELEBRATE_MS is 2150; wait past it and the dialog should have arrived
  // on its own, with nothing clicked.
  await page.waitForTimeout(2800);
  const dialogLate = await dialog.isVisible().catch(() => false);
  const stillCelebrating = await page.locator('[data-celebrate="1"]').count();
  check(
    "and the result arrives when it finishes",
    dialogLate && stillCelebrating === 0,
    `dialog up ${dialogLate}, still celebrating ${stillCelebrating > 0}`,
  );
  const solvedLine = await page.locator("text=/Solved in/").count();
  check("it says what was solved", solvedLine > 0);
}

// --- 8. A SIGNED-OUT WIN ON THE DAILY IS TWO DIALOGS, IN ORDER.
//        The reveal first, then - only once that has been closed, so it
//        is not competing with what was just earned - the ask to keep it.
{
  const guest = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
  await guest.route("**://posthog.invalid/**", (r) => r.abort());
  await guest.route("**://*.posthog.com/**", (r) => r.abort());
  let n = 0;
  await guest.route(`${SB}/**`, (route) => {
    const u = route.request().url();
    let post = {};
    try { post = JSON.parse(route.request().postData() ?? "{}"); } catch {}
    const j = (o) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o) });
    // Third guess wins. No session is seeded, so this is a guest.
    if (u.includes("puzzle_guest_compare")) { n++; return j(grade(post.p_espn_id, n === 3 ? post.p_espn_id : "x")); }
    if (u.includes("/rpc/")) return j({});
    return j([]);
  });
  const gp = await guest.newPage();
  await gp.goto(`${APP}/daily`, { waitUntil: "domcontentloaded" });
  // THE GUESS FIELD, not just any input in main. There is a second one
  // now - a one-pixel keep-alive that PLAY AGAIN focuses to hold the tap
  // gesture open while the real field mounts. It sits earlier in the DOM,
  // so a bare "main input:not([data-keyboard-keepalive])" selector picks it instead: invisible, one pixel
  // wide and pointer-events:none, which reads as the click being blocked
  // by whatever is painted over it.
  await gp.waitForSelector("main input:not([data-keyboard-keepalive])", { timeout: 20000 });
  await gp.waitForTimeout(900);
  const gf = gp.locator("main input:not([data-keyboard-keepalive])").first();
  for (const q of ["ma", "jo", "ty"]) {
    await gf.click(); await gf.fill(q); await gp.waitForTimeout(320);
    await gp.keyboard.press("Enter"); await gp.waitForTimeout(600);
  }
  await gp.waitForTimeout(3000);

  const solvedIn = await gp.locator("text=/Solved in/").count();
  const keepEarly = await gp.locator("text=/KEEP THIS RESULT/").count();
  check("a guest win shows the reveal first", solvedIn > 0 && keepEarly === 0, `reveal ${solvedIn > 0}, ask up ${keepEarly > 0}`);

  await gp.getByRole("button", { name: "Close result" }).click();
  await gp.waitForTimeout(600);
  const keepAfter = await gp.locator("text=/KEEP THIS RESULT/").count();
  const dialogUp = await gp.getByRole("dialog", { name: "Result" }).isVisible().catch(() => false);
  check("closing it brings the ask, as a dialog", keepAfter > 0 && dialogUp, `ask ${keepAfter > 0}, in a dialog ${dialogUp}`);

  await gp.getByRole("button", { name: "Close result" }).click();
  await gp.waitForTimeout(600);
  const anyDialog = await gp.getByRole("dialog", { name: "Result" }).isVisible().catch(() => false);
  const askInline = await gp.locator("text=/KEEP THIS RESULT/").count();
  check("closing that leaves a clean board", !anyDialog && askInline === 0, `dialog ${anyDialog}, inline ask ${askInline > 0}`);

  // And it does not nag: reopening the reveal must not queue the ask again.
  await gp.getByRole("button", { name: "SEE RESULT" }).click();
  await gp.waitForTimeout(500);
  await gp.getByRole("button", { name: "Close result" }).click();
  await gp.waitForTimeout(600);
  const nagged = await gp.locator("text=/KEEP THIS RESULT/").count();
  check("and it only asks once", nagged === 0, nagged ? "asked again on reopen" : "");
  await guest.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : "\nall checks pass");
process.exit(failed ? 1 : 0);
