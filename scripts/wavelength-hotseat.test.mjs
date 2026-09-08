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

// Press a value on the face. The hub is the middle of the flat bottom
// edge, the arc runs 0 on the left to 100 on the right, and the element is
// a scaled-down copy of a 1080-wide stage - so everything is worked out
// from the box the browser actually reports.
async function clickDialAt(dial, value) {
  const b = await dial.boundingBox();
  const r = b.width / 2;
  const ang = (1 - value / 100) * Math.PI;
  await dial.click({
    position: { x: r + r * 0.6 * Math.cos(ang), y: r - r * 0.6 * Math.sin(ang) },
  });
}

try {
  // networkidle, not domcontentloaded: a click landed before React
  // had attached does nothing at all, silently, and the failure that
  // produces looks exactly like a broken button.
  await page.goto(`${BASE}/wavelength`, { waitUntil: "networkidle" });

  // TWO STEPS, same as the draft: the deck first, then names and the OBS
  // link behind it.
  await page.getByRole("button", { name: /USE THIS DECK/i }).waitFor({ timeout: 40000 });
  // Everything, football only, and your own.
  ok("the picker offers three decks", (await page.locator("main button[aria-pressed]").count()) === 3);

  await page.getByRole("button", { name: /USE THIS DECK/i }).click();
  await page.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });
  ok("the setup screen restates the deck", (await page.getByRole("button", { name: /^Change$/ }).count()) === 1);
  // The rules panel shows a dial with its lid up. It is drawn by the same
  // component as the graphic and needs the same stylesheet - without it
  // the illustration of "the dial opens" is a dial that never opens.
  ok(
    "the rules picture shows an open dial",
    (await page.locator("main .wl-cover.wl-open").count()) === 1,
  );
  // The rules illustration on the setup screen is a dial with its wedge
  // showing, and it is not part of a round - so the leak checks below
  // start once the game has, not here.

  await page.getByRole("button", { name: /START THE GAME/i }).click();
  await page.getByRole("button", { name: /HOLD TO OPEN THE DIAL/i }).waitFor({ timeout: 30000 });
  ok("the first round comes up", (await page.getByRole("button", { name: /HOLD TO OPEN THE DIAL/i }).count()) === 1);

  // THE GRAPHIC SAYS NOTHING IT DOES NOT HAVE TO. It used to narrate
  // itself - the round, whose turn it was, what it was waiting for - and
  // all of that is on this screen already and being said out loud on the
  // stream. What is on the layer is the score, the dial and the clue.
  {
    const drawn = (await page.locator("main [data-band]").innerText()).toUpperCase();
    for (const chatter of ["ROUND", "WAITING", "THINKING", "TURNING", "FIRST TO"]) {
      ok(`the overlay does not say ${chatter.toLowerCase()}`, !drawn.includes(chatter), drawn.replace(/\n/g, " ").slice(0, 50));
    }
    // The names came off too - two colours and a pill say which side is
    // which, over a shot where both of them are on camera anyway.
    ok("nor the team names", !drawn.includes("TEAM 1") && !drawn.includes("TEAM 2"), drawn.replace(/\n/g, " ").slice(0, 50));
    ok("but it does carry the score", /\b0\b/.test(drawn) && drawn.includes("PSYCHIC"));
  }
  ok("nothing to undo yet", await page.getByRole("button", { name: /UNDO LAST MOVE/i }).isDisabled());

  // THE DIAL IS LIVE FROM THE OFF. It used to wait for a clue to be typed,
  // which is a toll gate on a game whose clue is SAID out loud - and on a
  // stream everybody already heard it.
  ok("the dial can be dragged with no clue typed", (await page.getByRole("slider").count()) === 1);
  // The reveal is its own button and it is not reachable yet. HOLD TO OPEN
  // THE DIAL is a different control with a similar name, hence the anchors.
  ok("nothing to reveal before a clue", (await page.getByRole("button", { name: /^OPEN THE DIAL$/ }).count()) === 0);

  // THE ONE PLACE THE TARGET IS SEEN, and it happens ON THE DIAL - the
  // same face the stream is watching, not a second picture beside it.
  ok("the target is not on screen", (await wedges()) === 0);
  ok("the lid starts shut", (await page.locator("main .wl-cover.wl-open").count()) === 0);
  await page.getByRole("button", { name: /HOLD TO OPEN THE DIAL/i }).hover();
  await page.mouse.down();
  await page.waitForTimeout(150);
  ok("holding opens the lid on the dial", (await page.locator("main .wl-cover.wl-open").count()) === 1);
  ok("and the wedge is under it", (await wedges()) > 0);
  await page.mouse.up();
  // The lid takes COVER_MS to swing back and the target stays in the state
  // until it has - so this waits past both rather than racing them.
  await page.waitForTimeout(150);
  ok("letting go starts it shutting at once", (await page.locator("main .wl-cover.wl-open").count()) === 0);
  await page.waitForTimeout(900);
  ok("and the wedge goes with it", (await wedges()) === 0);

  let rounds = 0;
  let leakedRounds = 0;
  let clues = 0;
  let skipped = 0;

  for (let steps = 0; steps < 120; steps++) {
    if (await page.getByRole("button", { name: /NEW GAME/i }).count()) break;

    // ---- the clue ----
    // Typed on some rounds and skipped entirely on others, because "you do
    // not have to type it" is only true if a round played without touching
    // the box actually finishes.
    const clue = rounds % 2 === 0 ? page.locator("main input[type=text]") : page.locator("main input[data-never]");
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
    // Dragged on the face, which is the only way to guess now. Clicking a
    // point is the same gesture the engine sees, and it also checks the
    // angle-to-value mapping: a dial that reads every press as 50 would
    // play a whole game without ever failing anything else here.
    const dial = page.getByRole("slider");
    await dial.waitFor({ timeout: 5000 });
    const want = [24, 41, 58, 72, 88][rounds % 5];
    await clickDialAt(dial, want);
    await page.waitForTimeout(120);
    const got = Number(await dial.getAttribute("aria-valuenow"));
    if (Math.abs(got - want) > 3) {
      ok("the dial lands where it was pressed", false, `asked ${want}, got ${got}`);
    }
    if ((await wedges()) > 0) leakedRounds++;

    // ---- the call, which is optional now ----
    if (rounds % 3 !== 2) {
      await page.getByRole("button", { name: rounds % 2 === 0 ? /LEFT$/ : /^RIGHT/ }).click();
      await page.waitForTimeout(80);
      if ((await wedges()) > 0) leakedRounds++;
      skipped += 0;
    } else {
      skipped++;
    }

    // ---- and only now ----
    // Named the same whether it is reached through the call or straight
    // from the dial, so this one press ends the round either way.
    await page.getByRole("button", { name: /OPEN THE DIAL$/ }).first().click();
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
  ok("rounds finished without typing a clue", clues < rounds, `${clues} clues typed over ${rounds} rounds`);
  ok("and rounds finished without calling a side", skipped > 0, `${skipped} calls skipped`);
  ok("the target is never on screen before the reveal", leakedRounds === 0, `${rounds} rounds watched`);
  ok("somebody reached the score", /WINS/.test(await page.locator("main [data-band]").innerText()));
  ok("undo is live once moves have been made", !(await page.getByRole("button", { name: /UNDO LAST MOVE/i }).isDisabled()));
  ok("nothing threw", errors.length === 0, errors.slice(0, 2).join(" | "));

  // And it can be played again without a reload.
  await page.getByRole("button", { name: /NEW GAME/i }).click();
  await page.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });
  ok("NEW GAME returns to setup", true);

  // ---- CO-OP, which is the mode most nights actually use ----------------
  //
  // Two people on the same side, a fixed run, one pile. Played through here
  // rather than only in the engine tests because the mode changes what the
  // BOARD offers - there is no side to call, so a round is two presses -
  // and a rule that is right while the button is missing is no use.
  await page.getByRole("button", { name: /CO-OP/ }).click();
  await page.waitForTimeout(120);
  await page.getByRole("button", { name: /START THE GAME/i }).click();
  await page.getByRole("button", { name: /HOLD TO OPEN THE DIAL/i }).waitFor({ timeout: 30000 });

  const band0 = await page.locator("main [data-band]").innerText();
  ok("a co-op run shows one pile, not two scores", /0\s*\/\s*\d+/.test(band0.replace(/\n/g, " ")), band0.replace(/\n/g, " "));
  ok("and still says nothing about rounds", !band0.toUpperCase().includes("ROUND"));

  let coopRounds = 0;
  let coopLeaks = 0;
  for (let steps = 0; steps < 40; steps++) {
    if (await page.getByRole("button", { name: /GO AGAIN/i }).count()) break;
    const dial = page.getByRole("slider");
    await dial.waitFor({ timeout: 5000 });
    await clickDialAt(dial, [30, 55, 70][coopRounds % 3]);
    await page.waitForTimeout(120);
    if ((await wedges()) > 0) coopLeaks++;
    // No LEFT / RIGHT in co-op: there is nobody to call it.
    if (await page.getByRole("button", { name: /LEFT$/ }).count()) {
      ok("co-op offers no side to call", false, `round ${coopRounds + 1}`);
    }
    await page.getByRole("button", { name: /OPEN THE DIAL$/ }).first().click();
    await page.waitForTimeout(150);
    coopRounds++;
    const next = page.getByRole("button", { name: /NEXT ROUND/i });
    if (await next.count()) {
      await next.click();
      await page.waitForTimeout(100);
    }
  }
  ok("a co-op run ends on its own", (await page.getByRole("button", { name: /GO AGAIN/i }).count()) > 0, `${coopRounds} rounds`);
  ok("a built-in deck runs five", coopRounds === 5, `${coopRounds}`);
  ok("the target stays hidden in co-op too", coopLeaks === 0);
  {
    const done = await page.locator("main [data-band]").innerText();
    ok("and it finishes on a total", /\d+ OUT OF \d+/.test(done.replace(/\n/g, " ")), done.replace(/\n/g, " ").slice(0, 60));
  }

  // ---- A DECK SOMEBODY TYPED ---------------------------------------------
  //
  // Written on the picker, kept in the browser, and dealt like any other
  // deck. The words have to reach the graphic, because those two ends are
  // the entire round.
  await page.goto(`${BASE}/wavelength`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /YOUR OWN/i }).click();
  await page.waitForTimeout(150);
  ok(
    "an empty custom deck cannot be used",
    await page.getByRole("button", { name: /USE THIS DECK/i }).isDisabled(),
  );

  const written = [
    ["Worst team", "Best team"],
    ["Worst call", "Best call"],
  ];
  for (const [left, right] of written) {
    await page.getByRole("button", { name: /ADD A PAIR/i }).click();
    await page.waitForTimeout(80);
    const rows = page.locator('main input[placeholder="Worst team"]');
    const i = (await rows.count()) - 1;
    await rows.nth(i).fill(left);
    await page.locator('main input[placeholder="Best team"]').nth(i).fill(right);
    await page.waitForTimeout(80);
  }
  ok(
    "writing a pair makes it usable",
    !(await page.getByRole("button", { name: /USE THIS DECK/i }).isDisabled()),
  );

  // Half a pair is not a card, and the count has to say so.
  await page.getByRole("button", { name: /ADD A PAIR/i }).click();
  await page.waitForTimeout(120);
  await page.locator('main input[placeholder="Worst team"]').last().fill("Only one end");
  await page.waitForTimeout(150);
  ok(
    "half a pair does not count as a card",
    (await page.getByRole("button", { name: /YOUR OWN/i }).innerText()).includes("2 cards"),
    (await page.getByRole("button", { name: /YOUR OWN/i }).innerText()).replace(/\n/g, " "),
  );

  await page.getByRole("button", { name: /USE THIS DECK/i }).click();
  await page.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });
  // A WRITTEN RUN IS ITS OWN LENGTH. Two pairs is four rounds, because
  // each of the two takes a turn being the psychic on each pair - so the
  // setup screen has to be offering four, not five.
  ok(
    "co-op on a written deck offers a run the length of the list",
    (await page.getByRole("button", { name: /CO-OP/ }).innerText()).includes("4 rounds"),
    (await page.getByRole("button", { name: /CO-OP/ }).innerText()).replace(/\n/g, " "),
  );
  await page.getByRole("button", { name: /START THE GAME/i }).click();
  await page.getByRole("button", { name: /HOLD TO OPEN THE DIAL/i }).waitFor({ timeout: 30000 });
  {
    const drawn = (await page.locator("main [data-band]").innerText()).toUpperCase();
    const dealt = written.some(([l, r]) => drawn.includes(l.toUpperCase()) && drawn.includes(r.toUpperCase()));
    ok("a written pair is dealt onto the graphic", dealt, drawn.replace(/\n/g, " ").slice(0, 70));
  }

  // Play it out and watch which pair comes up with whom. Both people must
  // get a turn on both pairs, which is the whole reason it is four rounds.
  {
    const seen = [];
    for (let steps = 0; steps < 20; steps++) {
      if (await page.getByRole("button", { name: /GO AGAIN/i }).count()) break;
      const band = (await page.locator("main [data-band]").innerText()).toUpperCase();
      const which = written.findIndex(([l]) => band.includes(l.toUpperCase()));
      // Read whoever the board actually names, rather than assuming what
      // the two of them are called - the defaults are not what this test
      // first guessed, and guessing made every round look identical.
      const who = (await page.locator("main").innerText()).match(/(.+?) IS THE PSYCHIC/i)?.[1] ?? "?";
      seen.push(`${which}:${who}`);
      await clickDialAt(page.getByRole("slider"), 50);
      await page.waitForTimeout(100);
      await page.getByRole("button", { name: /OPEN THE DIAL$/ }).first().click();
      await page.waitForTimeout(150);
      const next = page.getByRole("button", { name: /NEXT ROUND/i });
      if (await next.count()) {
        await next.click();
        await page.waitForTimeout(120);
      }
    }
    ok("two written pairs is a four round run", seen.length === 4, seen.join(" "));
    ok("every pair is played by both of them", new Set(seen).size === 4, seen.join(" "));
  }
  // And it survives a reload, which is the whole reason it is stored.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });
  await page.getByRole("button", { name: /^Change$/ }).click();
  await page.waitForTimeout(200);
  ok(
    "the pairs are still there after a reload",
    (await page.getByRole("button", { name: /YOUR OWN/i }).innerText()).includes("2 cards"),
  );

  // THE GRAPHIC HAS TO FIT BETWEEN THE TWO CAMERAS, and this is the only
  // way to know: the band is 800px tall at the default 560/560, the
  // content grows with the clue, the headline and the steal line, and
  // anything over 800 spills straight onto somebody's face on the stream.
  // It cannot be seen on the control board, where there are no cam bands
  // at all - so it is measured on the real browser source.
  for (const phase of ["clue", "guess", "steal", "reveal"]) {
    await page.goto(`${BASE}/wavelength/overlay?phase=${phase}&top=560&bottom=560`, { waitUntil: "networkidle" });
    const fit = await page.evaluate(() => {
      const band = document.querySelector("[data-band]");
      const kids = [...band.children].filter((k) => Number.isFinite(k.offsetHeight));
      const top = Math.min(...kids.map((k) => k.offsetTop));
      const bottom = Math.max(...kids.map((k) => k.offsetTop + k.offsetHeight));
      return { content: bottom - top, band: band.offsetHeight };
    });
    ok(`the graphic clears the cam bands (${phase})`, fit.content <= fit.band, `${fit.content} of ${fit.band}px`);
  }
} finally {
  await browser.close();
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
