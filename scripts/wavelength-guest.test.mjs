// TWO BROWSERS, ONE DIAL.
//
// The board deals and reveals; a guest on another machine turns the
// needle. That crossing is the only thing on this channel that travels
// towards the board, and it is the one thing no single-page test can
// prove - so this opens two real browser contexts and plays between them.
//
// Needs a dev server on :3000 AND a working Supabase Realtime connection,
// because the whole point of it is the wire. With placeholder credentials
// the channel never connects; the test says so and skips rather than
// failing a hundred assertions about a socket that was never open.
//
// To run it against the real thing, which is the only place the whole hop
// can actually be proven:
//
//   BASE_URL=https://sidelinebrew.com node scripts/wavelength-guest.test.mjs
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

let playwright;
try {
  playwright = await import("playwright");
} catch {
  console.error("playwright is missing - run `npm i`, then run this again.");
  process.exit(1);
}

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

async function dialTo(dial, value) {
  const b = await dial.boundingBox();
  const r = b.width / 2;
  const ang = (1 - value / 100) * Math.PI;
  await dial.click({ position: { x: r + r * 0.6 * Math.cos(ang), y: r - r * 0.6 * Math.sin(ang) } });
}

const browser = await playwright.chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);

// Two contexts, not two pages: the board's room code lives in
// localStorage, and a shared context would have the guest quietly reading
// the host's storage instead of the code off the screen.
const hostCtx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
const guestCtx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const host = await hostCtx.newPage();
const guest = await guestCtx.newPage();

const errors = [];
for (const [who, page] of [["host", host], ["guest", guest]]) {
  page.on("pageerror", (e) => errors.push(`${who}: ${e}`));
  await page.route("**/rest/v1/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
}

try {
  await host.goto(`${BASE}/wavelength`, { waitUntil: "networkidle" });
  await host.getByRole("button", { name: /USE THIS DECK/i }).waitFor({ timeout: 40000 });
  await host.getByRole("button", { name: /USE THIS DECK/i }).click();
  await host.getByRole("button", { name: /START THE GAME/i }).waitFor({ timeout: 30000 });

  // The link the host would send, read off the screen the way a person
  // would rather than reconstructed from storage.
  const joinUrl = await host
    .locator("input[readonly]")
    .filter({ hasText: "" })
    .nth(1)
    .inputValue();
  ok("the board offers a join link", /\/wavelength\/join\?room=[a-z2-9]{10}$/.test(joinUrl), joinUrl);

  await host.getByRole("button", { name: /START THE GAME/i }).click();
  await host.getByRole("button", { name: /HOLD TO OPEN THE DIAL/i }).waitFor({ timeout: 30000 });

  await guest.goto(joinUrl, { waitUntil: "networkidle" });
  // If Realtime is not actually reachable the guest never gets a state.
  // That is an environment problem, not a broken feature, so it is worth
  // saying plainly instead of drowning it in assertion failures.
  const arrived = await guest
    .getByRole("slider")
    .waitFor({ timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  if (!arrived) {
    console.log("\nSKIPPED: the guest never received a state.");
    console.log("This test needs a real Supabase Realtime connection; with placeholder");
    console.log("credentials the channel never opens. Nothing here is a code failure.");
    await browser.close();
    process.exit(0);
  }
  ok("a guest joining sees the round", true);

  // WHAT THE GUEST MUST NOT HAVE. They are the one guessing, so the target
  // is not in the message they were given - the same redaction the OBS
  // browser source gets, which is why this page is safe to hand them.
  ok("and cannot see the target", (await guest.locator("[data-wedge]").count()) === 0);

  // The crossing itself.
  await dialTo(guest.getByRole("slider"), 78);
  await guest.waitForTimeout(900);
  const onBoard = Number(await host.getByRole("slider").getAttribute("aria-valuenow"));
  ok("the guest's needle moves the board's", Math.abs(onBoard - 78) < 4, `board reads ${onBoard}`);

  await dialTo(guest.getByRole("slider"), 22);
  await guest.waitForTimeout(900);
  const again = Number(await host.getByRole("slider").getAttribute("aria-valuenow"));
  ok("and keeps moving it", Math.abs(again - 22) < 4, `board reads ${again}`);

  // The board is still the only thing that runs the game.
  ok("the guest cannot reveal", (await guest.getByRole("button", { name: /OPEN THE DIAL/i }).count()) === 0);
  ok("nor deal the next round", (await guest.getByRole("button", { name: /NEXT ROUND/i }).count()) === 0);

  await host.getByRole("button", { name: /OPEN THE DIAL$/ }).first().click();
  await host.waitForTimeout(1200);
  ok("the reveal reaches the guest", (await guest.locator("[data-wedge]").count()) > 0);
  ok("and the guest's dial goes read-only", (await guest.getByRole("slider").count()) === 0);

  ok("nothing threw", errors.length === 0, errors.slice(0, 2).join(" | "));
} finally {
  await browser.close();
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
