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
  await page.getByRole("button", { name: /START THE DRAFT/i }).waitFor({ timeout: 20000 });
  ok("the setup screen offers a format", (await page.locator("main button").count()) >= 3, "");

  await page.getByRole("button", { name: /START THE DRAFT/i }).click();
  await page.getByText(/LOT 1/).waitFor({ timeout: 10000 });
  ok("the first lot comes up", true, "");

  // The opener has to bid, even if it is nothing - so there is no PASS
  // until somebody has opened. Rule 2, as seen from the screen.
  const labels0 = await page.locator("main button").allInnerTexts();
  ok("the opener cannot pass", !labels0.includes("PASS"), "no PASS button before an opening bid");
  ok("and is offered a $0 bid", labels0.some((t) => t === "BID $0"), "");

  let lots = 0;
  let steps = 0;
  const prices = [];

  for (; steps < 400; steps++) {
    if (await page.getByText("DRAFT COMPLETE").count()) break;
    const labels = await page.locator("main button").allInnerTexts();
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
  const body = await page.locator("main").innerText();
  ok("no slot was left empty", !body.includes("—"), "an em dash is an empty slot");
  const budgets = [...body.matchAll(/\$(\d+)\n/g)].map((m) => Number(m[1]));
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
