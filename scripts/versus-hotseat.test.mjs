// A whole draft, played in a real browser, start to finish.
//
// The engine tests prove the rules; this proves the board actually lets
// you reach them. They are different failures: a rule can be right while
// the only button that would trigger it is disabled, or missing, or
// covered by something. Playing all ten lots is the cheapest way to know
// the screen and the engine agree.
//
// Needs a dev server on :3000 and the /versus route, which is unlinked -
// see src/app/versus/layout.tsx.
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
// Kept in step with src/components/versus/style.ts by hand - a browser
// test cannot import a TS module, and getting this wrong only makes the
// test slow or flaky, never wrong about the game.
const SPIN_MS = 2600;

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
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(50)} ${detail}`);
  if (!cond) failed++;
}

const browser = await playwright.chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
);
const context = await browser.newContext({ viewport: { width: 820, height: 1100 } });
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// The board needs no database at all - that is the point of hotseat - so
// anything that does reach for one is answered empty rather than left
// hanging.
await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));

try {
  await page.goto(`${BASE}/versus`, { waitUntil: "domcontentloaded" });

  // TWO STEPS NOW. The landing screen is the game select - a hero for
  // the mode you are on and a tile per mode - and the names, the OBS
  // link and START live on a second screen behind PICK THIS DRAFT.
  await page.getByRole("button", { name: /PICK THIS DRAFT/i }).waitFor({ timeout: 20000 });
  ok("the picker offers a tile per format", (await page.locator("main button[title]").count()) >= 2, "");
  ok(
    "and the hero names the one you are on",
    (await page.locator("main h2").first().textContent())?.trim().length > 0,
    (await page.locator("main h2").first().textContent())?.trim(),
  );

  // THE CARD AND ITS TILE ARE THE SAME THREE. The hero used to walk a
  // spread of the pool from wherever the stride began, so a tile saying
  // Kansas City / Dallas / Philly opened a card saying Arizona - one
  // mode wearing two faces on one screen. Read off a fresh load, so
  // this is the opening frame and not wherever the cycle got to.
  {
    const shown = await page.evaluate(() => {
      const src = (sel) => document.querySelector(`main ${sel} img`)?.getAttribute("src") ?? null;
      const hero = [src(".gs-left"), src(".gs-front"), src(".gs-right")];
      const tile = [...document.querySelectorAll("main button[title]")[0].querySelectorAll("img")].map((e) =>
        e.getAttribute("src"),
      );
      return { hero, tile };
    });
    const short = (u) => (u ?? "").split("/").pop();
    ok(
      "the card opens on its own tile's three",
      JSON.stringify(shown.hero) === JSON.stringify(shown.tile),
      `card ${shown.hero.map(short).join(",")} / tile ${shown.tile.map(short).join(",")}`,
    );
  }

  await page.getByRole("button", { name: /PICK THIS DRAFT/i }).click();
  await page.getByRole("button", { name: /START THE DRAFT/i }).waitFor({ timeout: 10000 });
  ok("the setup screen restates the draft", (await page.getByRole("button", { name: /^CHANGE$/ }).count()) === 1, "");

  await page.getByRole("button", { name: /START THE DRAFT/i }).click();
  await page.getByText(/LOT 1/).waitFor({ timeout: 10000 });
  ok("the first lot comes up", true, "");

  ok("nothing to undo yet", await page.getByRole("button", { name: /UNDO LAST MOVE/i }).isDisabled(), "");

  // Every lot is started by the host and lands off a reel. Until it does,
  // nobody can bid - the engine keeps toAct null through both phases, and
  // this is that guarantee seen from the screen, which is where it
  // actually matters.
  const beforeStart = await page.locator("main button").allInnerTexts();
  ok("a lot waits to be started", beforeStart.includes("START"), "");
  ok("and no bid is offered at a reel", !beforeStart.some((t) => t.startsWith("BID $")), "");
  await page.getByRole("button", { name: /^START$/ }).click();
  await page.waitForTimeout(SPIN_MS + 400);

  // Rule 2 from the screen: the floor is $0 and it belongs to whoever is
  // on the clock, so the cheapest thing they can do is a DOLLAR - and
  // passing is offered from the start, because passing is what hands the
  // free one across.
  const labels0 = await page.locator("main button").allInnerTexts();
  ok("the cheapest bid is a dollar", labels0.some((t) => t === "BID $1"), "$0 is already theirs");
  ok("and nothing offers $0", !labels0.some((t) => t === "BID $0"), "");
  ok("passing is offered at the floor", labels0.includes("PASS"), "it hands the free one across");

  // Pass, and the other player is offered it for nothing.
  await page.getByRole("button", { name: /^PASS$/ }).click();
  await page.waitForTimeout(120);
  const offered = await page.locator("main button").allInnerTexts();
  ok("passing offers it to the other player", offered.includes("TAKE FOR $0"), "");
  ok("and the free one replaces the bid stepper", !offered.some((t) => t.startsWith("BID $")), "");

  let lots = 0;
  let steps = 0;
  const prices = [];

  for (; steps < 400; steps++) {
    if (await page.getByText("DRAFT COMPLETE").count()) break;
    const labels = await page.locator("main button").allInnerTexts();
    // A new lot: start it, and let the reel land.
    if (labels.includes("START")) {
      await page.getByRole("button", { name: /^START$/ }).click();
      await page.waitForTimeout(SPIN_MS + 400);
      continue;
    }
    // Offered it for nothing: take it, and the draft moves on.
    if (labels.includes("TAKE FOR $0")) {
      await page.getByRole("button", { name: /^TAKE FOR \$0$/ }).click();
      await page.waitForTimeout(60);
      continue;
    }
    // An assign button is the only one carrying two lines: the slot, then
    // what you get in it.
    const assignIdx = labels.findIndex((t) => t.includes("\n"));
    if (assignIdx >= 0) {
      await page.locator("main button").nth(assignIdx).click();
      lots++;
    } else {
      const pass = labels.indexOf("PASS");
      const bid = labels.findIndex((t) => t.startsWith("BID $"));
      if (pass >= 0 && Math.random() < 0.5) await page.locator("main button").nth(pass).click();
      else if (bid >= 0) {
        prices.push(Number(labels[bid].replace("BID $", "")));
        await page.locator("main button").nth(bid).click();
      } else break;
    }
    await page.waitForTimeout(40);
  }

  ok("the draft plays to the end", (await page.getByText("DRAFT COMPLETE").count()) > 0, `${steps} clicks`);
  ok("ten lots were assigned", lots === 10, `${lots}`);

  // Both rosters full, and neither budget below zero - the same two
  // guarantees the engine fuzz checks, confirmed through the UI.
  //
  // Read off the GRAPHIC. The board used to print both rosters a second
  // time below the overlay and this read those; the graphic is the only
  // copy now, which is the better thing to be asserting on anyway - it is
  // the copy the viewers see.
  const picks = page.locator("main [data-pick]");
  const total = await picks.count();
  ok("every slot is on screen", total === 10, `${total} picks drawn`);
  const filled = await page.locator('main [data-pick][data-filled="1"]').count();
  ok("no slot was left empty", filled === total, `${filled}/${total} filled`);

  const budgets = await page.locator("main [data-budget]").evaluateAll((els) =>
    els.map((e) => Number(e.getAttribute("data-amount"))),
  );
  ok("both budgets are on screen", budgets.length === 2, `${budgets.length}`);
  ok("nobody finished overdrawn", budgets.every((b) => b >= 0), budgets.join(", "));

  ok("nothing threw", errors.length === 0, errors.slice(0, 2).join(" | "));

  // And it can be played again without a reload.
  await page.getByRole("button", { name: /NEW DRAFT/i }).click();
  await page.getByRole("button", { name: /START THE DRAFT/i }).waitFor({ timeout: 10000 });
  ok("NEW DRAFT returns to setup", true, "");
} finally {
  await browser.close();
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
