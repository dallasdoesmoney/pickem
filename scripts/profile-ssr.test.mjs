// Does a creator's profile exist in the HTML before any JavaScript runs?
//
// That is the entire point of splitting /leaderboard/[username] into a
// server page plus ProfileClient, and it is the one thing a screenshot
// cannot show you: the old client page rendered a spinner, went and found
// the player, and filled the name in afterwards. It looked identical. But
// a crawler, and every chat app that unfurls a pasted link, reads the
// first response and leaves - so every creator's profile link, the link
// the whole creator-forward idea rests on, unfurled as the generic site
// card with the generic site title.
//
// So this suite does not drive a browser for the important half. It asks
// for the page the way a scraper does - one GET, no JavaScript at all -
// and reads the bytes that come back.
//
// Supabase is stubbed by a real HTTP server rather than by Playwright's
// router, because the fetch under test happens in the Next process before
// a browser exists. See scripts/lib/leaderboardStub.mjs.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { startLeaderboardStub } from "./lib/leaderboardStub.mjs";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

// A deliberately unmistakable player. Every assertion below is looking
// for a string that could not have come from anywhere else on the page.
const PLAYER = {
  user_id: "00000000-0000-4000-8000-00000000beef",
  username: "ripcord_randall",
  display_name: "Ripcord Randall",
  avatar_url: null,
  correct: 40,
  graded: 62,
  total_points: 5200,
  streak: 7,
};
const RANK_AHEAD = 3; // so the page should say #4
const DIST_DIR = ".next-profile-ssr";

function freePort() {
  return new Promise((resolve) => {
    const s = createServer();
    s.listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const stub = await startLeaderboardStub([PLAYER]);
stub.setRankAhead(RANK_AHEAD);
const port = await freePort();
const base = `http://127.0.0.1:${port}`;

// A dev server of this suite's own, because the whole test is "what does
// the server send", and that depends on the env the server was started
// with. Real environment variables beat .env.local in Next, so pointing
// NEXT_PUBLIC_SUPABASE_URL at the stub here is enough.
const app = spawn("npm", ["run", "dev", "--", "--port", String(port)], {
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: stub.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon-key",
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: "phc_test",
    NEXT_PUBLIC_POSTHOG_HOST: "https://posthog.invalid",
    // Its own build directory, and so its own dev-server lock - see the
    // comment on distDir in next.config.ts. Without this, a `npm run dev`
    // already open on this project (or the one CI starts for the other
    // suites) makes this one refuse to start.
    NEXT_DIST_DIR: DIST_DIR,
  },
  stdio: ["ignore", "pipe", "pipe"],
  // `npm run dev` is a shell that spawns `next dev` that spawns the
  // server. Signalling npm leaves the other two alive, holding the port
  // and the dev lock - which is how the second run of this suite ends up
  // colliding with the first one's leftovers. Its own process group means
  // one kill reaches all three.
  detached: true,
});
let appLog = "";
app.stdout.on("data", (d) => (appLog += d));
app.stderr.on("data", (d) => (appLog += d));

async function cleanup() {
  try {
    process.kill(-app.pid, "SIGTERM");
  } catch {}
  await stub.close();
  // The generated route types are in tsconfig's include (Next put them
  // there itself on first run), so leaving them behind would mean a stale
  // validator failing `tsc --noEmit` the next time a route is renamed.
  // The compiled output stays, so a second run is still warm.
  await rm(join(process.cwd(), DIST_DIR, "types"), { recursive: true, force: true });
  await rm(join(process.cwd(), DIST_DIR, "dev", "types"), { recursive: true, force: true });
}

try {
  if (!(await waitFor(`${base}/leaderboard`))) {
    console.error("the app never came up:\n" + appLog);
    await cleanup();
    process.exit(1);
  }

  // --- the profile, as a scraper sees it -------------------------------
  const res = await fetch(`${base}/leaderboard/${PLAYER.username}`);
  const html = await res.text();

  ok("the profile answers 200", res.status === 200, String(res.status));

  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  ok("the tab says who it is", title.includes("Ripcord Randall") && title.includes("@ripcord_randall"), title);

  // The name in the BODY, not just the head - a card whose title is right
  // and whose page is a spinner is still a page that needs JavaScript.
  const body = html.slice(html.indexOf("<body"));
  ok("and the name is in the body too", body.includes("Ripcord Randall"), "no JS run at all");

  const meta = (prop, attr = "property") => {
    const re = new RegExp(`<meta[^>]*${attr}="${prop}"[^>]*content="([^"]*)"`);
    const alt = new RegExp(`<meta[^>]*content="([^"]*)"[^>]*${attr}="${prop}"`);
    return (html.match(re) ?? html.match(alt))?.[1] ?? "";
  };

  const ogTitle = meta("og:title");
  ok("og:title names the player", ogTitle.includes("Ripcord Randall"), ogTitle);

  const desc = meta("description", "name");
  ok("the description gives the rank", desc.includes("#4"), desc);
  ok("and the record, wins first", desc.includes("40-22"), `${PLAYER.correct}-${PLAYER.graded - PLAYER.correct}`);
  ok("and the live streak", desc.includes("7 day streak"), desc);
  ok("og:description matches it", meta("og:description") === desc);
  ok("twitter gets a large card", meta("twitter:card", "name") === "summary_large_image");
  ok("og:type is a profile", meta("og:type") === "profile");

  const canonical = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]*)"/)?.[1] ?? "";
  ok("canonical is absolute and correct", canonical === `https://sidelinebrew.com/leaderboard/${PLAYER.username}`, canonical);

  const ogImage = meta("og:image");
  ok("og:image is this player's card", /leaderboard\/ripcord_randall\/opengraph-image/.test(ogImage), ogImage);
  ok("and not the site default", !ogImage.includes("og-default"), ogImage);

  // --- the card itself --------------------------------------------------
  // In dev, metadataBase resolves against localhost rather than the live
  // site, so the origin is swapped rather than assumed.
  const imgUrl = new URL(new URL(ogImage).pathname + new URL(ogImage).search, base).toString();
  const img = await fetch(imgUrl);
  const bytes = Buffer.from(await img.arrayBuffer());
  ok("the card renders", img.status === 200, `${img.status}, ${bytes.byteLength} bytes`);
  ok("as a real PNG", bytes.subarray(1, 4).toString() === "PNG", bytes.subarray(0, 8).toString("hex"));
  // Width and height live in the IHDR chunk, bytes 16-23.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  ok("at the size every scraper wants", width === 1200 && height === 630, `${width}x${height}`);

  // --- a username that does not exist -----------------------------------
  const missing = await fetch(`${base}/leaderboard/nobody_at_all`);
  const missingHtml = await missing.text();
  ok("an unknown player is not indexed", /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(missingHtml), "noindex");
  ok("and says so rather than spinning", missingHtml.includes("No player found"), "");
  ok("and does not borrow the last player's name", !missingHtml.includes("Ripcord Randall"), "");

  const missingImg = await fetch(`${base}/leaderboard/nobody_at_all/opengraph-image`);
  const missingBytes = Buffer.from(await missingImg.arrayBuffer());
  ok(
    "its card still renders rather than 500ing",
    missingImg.status === 200 && missingBytes.subarray(1, 4).toString() === "PNG",
    `${missingImg.status}, ${missingBytes.byteLength} bytes`
  );

  // --- and once JavaScript does run, nothing regressed -------------------
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    console.error("\nplaywright is missing - run `npm i` (it is in devDependencies)");
    await cleanup();
    process.exit(1);
  }
  // The same conditional every other suite uses: CHROME_PATH when a machine
  // has a browser already, and nothing at all on a runner, where Playwright
  // finds the one it installed for itself. Passing `executablePath: undefined`
  // happens to work, but "the same as the other seven" is worth more here than
  // saving a ternary.
  const browser = await playwright.chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
  );
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const p1 = await noJs.newPage();
  await p1.goto(`${base}/leaderboard/${PLAYER.username}`, { waitUntil: "domcontentloaded" });
  ok("with JavaScript off, the name is on screen", await p1.getByText("Ripcord Randall").first().isVisible(), "");
  ok("and the handle under it", await p1.getByText("@ripcord_randall").first().isVisible(), "");
  await noJs.close();

  const withJs = await browser.newContext();
  const p2 = await withJs.newPage();
  // The stub only knows the leaderboard view; the rest of the profile's
  // client-side fetches are answered empty so the page is not waiting on
  // a network that is not there.
  await p2.route("**/rest/v1/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  const errors = [];
  p2.on("pageerror", (e) => errors.push(String(e)));
  await p2.goto(`${base}/leaderboard/${PLAYER.username}`, { waitUntil: "domcontentloaded" });
  await p2.waitForTimeout(1500);
  ok("with JavaScript on, the name is still there", await p2.getByText("Ripcord Randall").first().isVisible(), "");
  ok("and hydration threw nothing", errors.length === 0, errors.slice(0, 2).join(" | "));
  await browser.close();
} catch (err) {
  // A throw here is almost always the app returning something that is not
  // a page - a route that 500'd, a fetch that never connected - and the
  // app's own log is the only place that says why.
  console.error("\nthe run threw: " + (err?.stack ?? err));
  console.error("\nlast of the app log:\n" + appLog.slice(-4000));
  failed++;
} finally {
  await cleanup();
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
