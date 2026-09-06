// A whole game of Wavelength, played in a real browser, start to finish.
//
// The engine tests prove the rules and the redaction; this proves the
// board actually lets you reach them, and - the part that cannot be
// tested any other way - that the answer is not sitting on the screen
// everybody is looking at.
//
// Needs a dev server on :3000 and the /wavelength route, which is
// unlinked - see src/app/wavelength/layout.tsx.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.error("playwright is missing - run `npm i`, then run this again.");
  console.error("Set CHROME_PATH to a browser path if you have one already.");
  process.exit(1);
}

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

const browser = await playwright.chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const context = await browser.newContext({ viewport: { width: 820, height: 1100 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// The board needs no database at all - that is the point of a hot seat -
// so anything that does reach for one is answered empty rather than left
// hanging.
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

const wedges = () => page.locator("main [data-wedge]").count();

try {
  // networkidle, not domcontentloaded: a click landed before React
  // had attached does nothing at all, silently, and the failure that
  // produces looks exactly like a broken button.
  await page.goto(`${BASE}/wavelength`, { waitUntil: "networkidle" });

  // TWO STEPS, same as the draft: the deck first, then names and the OBS
  // link behind it.
  await page.getByRole("button", { name: /USE THIS DECK/i }).waitFor({ timeout: 40000 });
  ok("the picker offers both decks", (await page.locator("main button[aria-pressed]").count()) === 2);

  await page.getByRole("button", { name: /USE THIS DECK/i }).click();
  await page.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });
  ok("the setup screen restates the deck", (await page.getByRole("button", { name: /^Change$/ }).count()) === 1);
  // The rules illustration on the setup screen is a dial with its wedge
  // showing, and it is not part of a round - so the leak checks below
  // start once the game has, not here.

  await page.getByRole("button", { name: /START THE GAME/i }).click();
  await page.getByRole("button", { name: /HOLD TO SEE THE TARGET/i }).waitFor({ timeout: 30000 });
  ok("the first round comes up", (await page.locator("main [data-band]").innerText()).includes("ROUND 1"));
  ok("nothing to undo yet", await page.getByRole("button", { name: /UNDO LAST MOVE/i }).isDisabled());

  // THE DIAL IS DEAD UNTIL THERE IS A CLUE. Otherwise a team can turn it
  // before anybody has said anything, which is not a round.
  ok("no dial before a clue", (await page.locator("main input[type=range]").count()) === 0);
  ok("nothing to reveal before a clue", (await page.getByRole("button", { name: /REVEAL/i }).count()) === 0);

  // THE ONE PLACE THE TARGET IS SEEN, and it is a press-and-hold.
  ok("the target is not on screen", (await wedges()) === 0);
  const peek = page.getByRole("button", { name: /HOLD TO SEE THE TARGET/i });
  await peek.hover();
  await page.mouse.down();
  await page.waitForTimeout(120);
  ok("holding shows the target", (await page.locator("main [data-peek]").count()) === 1);
  ok("and it is drawn as a wedge", (await wedges()) > 0);
  await page.mouse.up();
  await page.waitForTimeout(120);
  ok("letting go hides it again", (await page.locator("main [data-peek]").count()) === 0);
  ok("and the wedge goes with it", (await wedges()) === 0);

  let rounds = 0;
  let leakedRounds = 0;
  let clues = 0;

  for (let steps = 0; steps < 120; steps++) {
    if (await page.getByRole("button", { name: /NEW GAME/i }).count()) break;

    // ---- the clue ----
    const clue = page.locator("main input[type=text]");
    if (await clue.count()) {
      const word = ["Coffee", "Tuesday", "Airport", "Dentist"][clues % 4];
      await clue.fill(word);
      clues++;
      await page.waitForTimeout(120);
      // Typed straight onto the graphic - the whole reason the board
      // carries the clue at all. Checked once: if it works in round one
      // it is the same code path every round after.
      if (rounds === 0) {
        const drawn = await page.locator("main [data-band]").innerText();
        ok("the clue reaches the graphic as it is typed", drawn.toUpperCase().includes(word.toUpperCase()), word);
      }
    }

    // ---- the dial ----
    const dial = page.locator("main input[type=range]");
    await dial.waitFor({ timeout: 5000 });
    await dial.fill(String(20 + ((rounds * 17) % 60)));
    await page.waitForTimeout(80);
    if ((await wedges()) > 0) leakedRounds++;

    // ---- the call ----
    await page.getByRole("button", { name: rounds % 2 === 0 ? /LEFT$/ : /^RIGHT/ }).click();
    await page.waitForTimeout(80);
    if ((await wedges()) > 0) leakedRounds++;

    // ---- and only now ----
    await page.getByRole("button", { name: /REVEAL THE TARGET/i }).click();
    await page.waitForTimeout(120);
    if ((await wedges()) === 0) {
      ok("the reveal draws the wedge", false, `round ${rounds + 1}`);
    }
    rounds++;

    const next = page.getByRole("button", { name: /NEXT ROUND/i });
    if (await next.count()) {
      await next.click();
      await page.waitForTimeout(80);
      if ((await wedges()) > 0) leakedRounds++;
    }
  }

  ok("the game plays to a winner", (await page.getByRole("button", { name: /NEW GAME/i }).count()) > 0, `${rounds} rounds`);
  ok("the target is never on screen before the reveal", leakedRounds === 0, `${rounds} rounds watched`);
  ok("somebody reached the score", /WINS/.test(await page.locator("main [data-band]").innerText()));
  ok("undo is live once moves have been made", !(await page.getByRole("button", { name: /UNDO LAST MOVE/i }).isDisabled()));
  ok("nothing threw", errors.length === 0, errors.slice(0, 2).join(" | "));

  // And it can be played again without a reload.
  await page.getByRole("button", { name: /NEW GAME/i }).click();
  await page.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });
  ok("NEW GAME returns to setup", true);
} finally {
  await browser.close();
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
