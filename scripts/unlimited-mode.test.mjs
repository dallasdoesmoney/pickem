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
    return json(grade(post.p_guess, post.p_answer));
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
const roundLine = (await page.locator("text=/Round 1/").count()) > 0;
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
const stillRoundOne = (await page.locator("text=/Round 1/").count()) > 0;
check(
  "the practice round survives it too",
  practiceRows === 1 && stillRoundOne,
  `${practiceRows} rows, still round 1 ${stillRoundOne}`,
);

// --- 6. Play out the round and check PLAY AGAIN deals a new player ---
for (let i = 0; i < 8 && !(await page.getByRole("button", { name: "PLAY AGAIN" }).count()); i++) {
  await guessSomething(String.fromCharCode(100 + i));
}
const firstAnswer = practiceAnswers[0];
const finished = (await page.getByRole("button", { name: "PLAY AGAIN" }).count()) > 0;
check("a lost round ends and offers another", finished, `after ${practiceAnswers.length} guesses`);

if (finished) {
  // The answer is revealed on a LOSS, which the daily deliberately never
  // does for a guest - here the browser already knows it and being told
  // is the point of practising.
  const revealed = (await page.locator("text=/Out of guesses/").count()) > 0;
  check("a lost practice round still reveals the player", revealed);

  const shareOffered = (await page.getByRole("button", { name: /SHARE RESULT/ }).count()) > 0;
  check("practice is not shareable", !shareOffered, "no SHARE RESULT button");

  await page.getByRole("button", { name: "PLAY AGAIN" }).click();
  await page.waitForTimeout(700);
  const roundTwo = (await page.locator("text=/Round 2/").count()) > 0;
  const clean = (await rows()) === 0;
  check("PLAY AGAIN starts round 2 with a clean board", roundTwo && clean, `round 2 ${roundTwo}, ${await rows()} rows`);

  await guessSomething("z");
  const secondAnswer = practiceAnswers[practiceAnswers.length - 1];
  check("and a different player", secondAnswer !== firstAnswer, `${firstAnswer} then ${secondAnswer}`);
}

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} FAILED` : "\nall checks pass");
process.exit(failed ? 1 : 0);
