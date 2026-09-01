// LOCK OF THE WEEK, and whether anybody can find it.
//
// Two things this guards, and the first is the reason it exists at all:
//
// 1. THE WORDS FIT. "SET YOUR LOCK" is thirteen characters of a wide
//    display face in a pill that is 144px across on a phone, and the
//    size is solved rather than picked (see fitPillText). The obvious
//    check - scrollWidth against clientWidth - does NOT catch a problem
//    here: the text row is a content-sized flex child, so it grows past
//    the pill instead of clipping and both numbers agree the whole way.
//    An early version overflowed by four pixels at 430px wide and passed
//    that check. So this measures the text's own box against the pill's,
//    at every width the pill is drawn at.
//
// 2. THE FLOW. Press the pill, the board becomes a chooser; tap a pick,
//    the lock lands and the mode ends. Including the empty case, where
//    somebody presses it before picking anything.
//
// Needs a dev server. No database: the board renders its games from
// src/data/games.ts and picking works signed out.
//
//   node scripts/lock-mode.test.mjs
//   APP_URL=http://localhost:3001 node scripts/lock-mode.test.mjs

import { chromium } from "playwright";

const APP = process.env.APP_URL ?? "http://localhost:3000";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

// ---------------------------------------------------------------- fit

// Every width the pill is drawn at: both ends of the kpi ramp (358 and
// 651 of content) and a spread of the interpolation between them, which
// is where the overflow actually was.
const WIDTHS = [320, 360, 390, 430, 500, 560, 651, 768, 1024, 1280, 1600];
const spills = [];

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 1000 } });
  await page.goto(`${APP}/weekly`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /SET YOUR LOCK/ }).waitFor({ timeout: 15000 });

  // Both labels, because CANCEL replaces SET YOUR LOCK in the same box.
  const measure = () =>
    page.getByRole("button", { name: /SET YOUR LOCK|CANCEL/ }).first().evaluate((el) => {
      const pill = el.getBoundingClientRect();
      const line = [...el.querySelectorAll("div")].find((d) => ["SET YOUR LOCK", "CANCEL"].includes(d.textContent.trim()));
      const caption = [...el.querySelectorAll("div")].find((d) => d.textContent.trim() === "LOCK OF THE WEEK");
      const lb = line.getBoundingClientRect();
      const cb = caption.getBoundingClientRect();
      return {
        text: line.textContent.trim(),
        font: Math.round(parseFloat(getComputedStyle(line).fontSize) * 10) / 10,
        // Positive means sticking out past the pill's own edge.
        left: Math.round(pill.left - lb.left),
        right: Math.round(lb.right - pill.right),
        captionSpill: Math.round(cb.width - pill.width),
        // Both rows still inside the pill's height.
        tall: Math.round(lb.height + cb.height) - Math.round(pill.height),
      };
    });

  const resting = await measure();
  await page.getByRole("button", { name: /SET YOUR LOCK/ }).click();
  await page.getByRole("button", { name: "CANCEL" }).waitFor({ timeout: 5000 });
  const active = await measure();
  await page.close();

  for (const m of [resting, active]) {
    if (m.left > 0 || m.right > 0 || m.captionSpill > 0 || m.tall > 0) {
      spills.push(`${width}px "${m.text}" @${m.font}px L${m.left} R${m.right} cap${m.captionSpill} h${m.tall}`);
    }
  }
  // A size that fits by going unreadably small is not a pass.
  ok(`${String(width).padEnd(4)} the label is still legible`, resting.font >= 11, `"${resting.text}" at ${resting.font}px`);
}

ok("the words fit the pill at every width", spills.length === 0, spills.length ? spills.join(" | ") : `${WIDTHS.length} widths, both labels`);

// --------------------------------------------------------------- flow

const page = await browser.newPage({ viewport: { width: 1280, height: 1500 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${APP}/weekly`, { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /SET YOUR LOCK/ }).waitFor({ timeout: 15000 });

const badges = () => page.locator('button[aria-label="Mark as Lock of the Week"]').count();
const bar = () => page.getByText(/Tap the pick you|Pick a winner first/).count();
const greyed = () => page.evaluate(() => document.querySelectorAll('div[style*="grayscale"]').length);
const cards = page.locator("div.relative.flex.items-center.mx-auto.shrink-0");

async function pickCard(i) {
  const box = await cards.nth(i).boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height / 2);
  await page.waitForTimeout(150);
}

ok("a fresh board shows no padlocks", (await badges()) === 0, "this was the bug: nothing to find");
ok("and no instruction bar", (await bar()) === 0);

// The empty case. Pressing it with nothing picked has to say something
// useful rather than open a chooser with no candidates in it.
await page.getByRole("button", { name: /SET YOUR LOCK/ }).click();
await page.getByText(/Pick a winner first/).waitFor({ timeout: 5000 });
ok("pressing it with no picks explains itself", (await bar()) === 1, (await page.getByText(/Pick a winner first/).innerText()).trim());
ok("and offers no padlock to press", (await badges()) === 0);
await page.getByRole("button", { name: "CANCEL" }).click();
await page.waitForTimeout(200);
ok("cancel puts the board back", (await bar()) === 0);

for (const i of [0, 1, 2]) await pickCard(i);
ok("three picks, and still no padlocks", (await badges()) === 0, "the badge only exists inside the mode");

await page.getByRole("button", { name: /SET YOUR LOCK/ }).click();
await page.getByText(/Tap the pick you/).waitFor({ timeout: 5000 });
const dimmedInMode = await greyed();
ok("the mode lights every pick", (await badges()) === 3, "3 picks, 3 padlocks");
ok("and tells you what to do", (await bar()) === 1);
ok("and steps the rest of the board back", dimmedInMode > 3, `${dimmedInMode} greyed`);

await page.locator('button[aria-label="Mark as Lock of the Week"]').first().click();
await page.locator('button[aria-label="Remove Lock of the Week"]').waitFor({ timeout: 5000 });
ok("one tap sets the lock", (await page.locator('button[aria-label="Remove Lock of the Week"]').count()) === 1);
ok("and ends the mode", (await bar()) === 0);
ok("the board comes back", (await greyed()) < dimmedInMode, `${await greyed()} greyed`);
ok("the other padlocks go away", (await badges()) === 0, "only the lock itself stays");
ok("and the pill is no longer a button", (await page.getByRole("button", { name: /SET YOUR LOCK|CANCEL/ }).count()) === 0, "it shows the team now");

await page.locator('button[aria-label="Remove Lock of the Week"]').click();
await page.getByRole("button", { name: /SET YOUR LOCK/ }).waitFor({ timeout: 5000 });
ok("clearing it hands the button back", (await page.getByRole("button", { name: /SET YOUR LOCK/ }).count()) === 1);
ok("and does not leave the mode running", (await bar()) === 0, "a cleared lock is not a chooser");

ok("nothing threw", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
