// Writes the share cards in public/ - the images a link unfurls into.
//
//   node scripts/gen-og-cards.mjs
//
// Static PNGs rather than an ImageResponse route: these never change per
// request, and a file cannot fail to render on a cold serverless start.
// They are committed, so this only has to run when a card changes.
//
// The daily card carries a REAL BOARD - two wrong guesses and then the
// answer, all six green. It used to be five blank chips, which had the
// right palette and none of the meaning; a stranger seeing colour with
// no words in it cannot tell what the game is.
//
// WHY THERE ARE NO HEADSHOTS ON IT. Every plate is team colour behind a
// name, and that is deliberate rather than a limitation worked around.
// An unfurl draws this at about 450px - 37% - and a headshot at 37% is a
// few pixels of face. Colour and a name survive the downscale; a
// portrait does not. It also means the card can be regenerated anywhere,
// with no dependency on ESPN's CDN being reachable.
// Playwright is NOT a dependency of this project, on purpose. It is a
// large install and this script runs a handful of times a year, so
// carrying it in devDependencies would put it in every CI and Netlify
// install to serve a file that is already committed. Resolved at run
// time instead, with an error that says what to do rather than a stack
// trace about a missing module.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "This script needs Playwright, which the project does not depend on.\n" +
      "  npx --yes playwright@latest install --with-deps chromium\n" +
      "  npm i --no-save playwright\n" +
      "then run it again. Set PLAYWRIGHT_CHROMIUM to a browser path if you have one already."
  );
  process.exit(1);
}
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "..", "public");

const logo = readFileSync(join(PUBLIC, "press-logo.png")).toString("base64");
// Bungee, subsetted to latin, committed beside this script. Inlined
// rather than linked because the renderer must not depend on the network
// to produce a font - a card that silently falls back to Arial is worse
// than one that fails. Open Font License, the same face next/font pulls
// for the site itself.
const bungee = readFileSync(join(HERE, "assets", "bungee-latin.woff2")).toString("base64");

const TONE = { hit: "#3ecb78", close: "#ffce3a", miss: "#aab3c1" };

// The board's own thresholds, so the card cannot claim a comparison the
// game would grade the other way: a division is close inside the same
// conference, and a number is close inside its column's tolerance. See
// CLOSE_MEANS in src/components/DailyPuzzle.tsx.
const ANSWER = { team: "LAR", conf: "NFC", div: "NFC West", pos: "WR", age: 25, ht: 74, no: 12 };

// Real rows out of src/data/rosters/all.ts. Fixed, and deliberately NOT
// today's puzzle - a share card that leaked the answer would spoil the
// game it is advertising.
const GUESSES = [
  { name: "Tee Higgins", bg: "#FB4F14", ink: "#fff", team: "CIN", conf: "AFC", div: "AFC North", pos: "WR", age: 27, ht: 76, no: 5 },
  { name: "Chris Olave", bg: "#D3BC8D", ink: "#101820", team: "NO", conf: "NFC", div: "NFC South", pos: "WR", age: 26, ht: 72, no: 12 },
  { name: "Puka Nacua", bg: "#003594", ink: "#fff", team: "LAR", conf: "NFC", div: "NFC West", pos: "WR", age: 25, ht: 74, no: 12 },
];

const near = (a, b, within) => (a === b ? "hit" : Math.abs(a - b) <= within ? "close" : "miss");
const feet = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;

// Derived, never typed. Editing a player's age above changes the colour
// of his chip here, which is the point.
const cells = (g) => [
  [g.team, g.team === ANSWER.team ? "hit" : "miss"],
  [g.div, g.div === ANSWER.div ? "hit" : g.conf === ANSWER.conf ? "close" : "miss"],
  [g.pos, g.pos === ANSWER.pos ? "hit" : "miss"],
  [String(g.age), near(g.age, ANSWER.age, 3)],
  [feet(g.ht), near(g.ht, ANSWER.ht, 2)],
  [String(g.no), near(g.no, ANSWER.no, 3)],
];

const SIZE = { plate: 250, gap: 12, h: 92, name: 28, chip: 24 };

const row = (g) => `
  <div class="row" style="grid-template-columns:${SIZE.plate}px repeat(6,minmax(0,1fr));gap:${SIZE.gap}px;height:${SIZE.h}px">
    <div class="plate" style="background:linear-gradient(100deg,${g.bg},${g.bg}cc);color:${g.ink}">
      <b style="font-size:${SIZE.name}px">${g.name}</b></div>
    ${cells(g)
      .map(([v, st]) => `<div class="chip" style="background:${TONE[st]};font-size:${SIZE.chip}px">${
        // DIV is the only two-word value, and side by side it does not fit
        // the chip - so it stacks, the way the board's own DIV chip does.
        v.includes(" ") ? v.split(" ").map((w) => `<span style="display:block">${w}</span>`).join("") : v
      }</div>`)
      .join("")}
  </div>`;

const CSS = `
@font-face{font-family:"Bungee";src:url(data:font/woff2;base64,${bungee}) format("woff2");font-display:block}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;background:#070e1c;overflow:hidden;position:relative;
     font-family:-apple-system,Segoe UI,Roboto,sans-serif}
.glow{position:absolute;width:900px;height:900px;border-radius:50%;right:-260px;top:-320px;
      background:radial-gradient(circle,rgba(143,164,196,0.16),transparent 62%)}
.k{font-family:Bungee;letter-spacing:.18em;color:#8fa4c4}
.t{font-family:Bungee;color:#fff;letter-spacing:.01em;line-height:.94}
.s{color:#7d8ca6;line-height:1.35}
.row{display:grid;align-items:stretch}
.plate{display:flex;align-items:center;border:3px solid #0a1120;border-radius:12px;
       box-shadow:4px 5px 0 #05090f;padding:0 16px;overflow:hidden;min-width:0}
.plate b{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chip{display:grid;place-items:center;text-align:center;color:#0a1020;font-weight:600;line-height:1.08;
      border:3px solid #0a1120;border-radius:12px;box-shadow:4px 5px 0 #05090f;min-width:0}
`;

const shell = (inner) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
   <body><span class="glow"></span>${inner}</body></html>`;

// The daily card. The winning row gets a green drop shadow and nothing
// else does, so the eye lands on the moment rather than reading three
// equal rows - which is the whole difference between this and a board
// that happens to be solved.
const DAILY = shell(`
  <div style="padding:52px 64px;height:630px;display:flex;flex-direction:column">
    <div style="display:flex;align-items:center;gap:28px;position:relative">
      <img src="data:image/png;base64,${logo}" style="width:132px;height:132px;flex-shrink:0">
      <div>
        <div class="k" style="font-size:19px;margin-bottom:10px">DAILY GAME</div>
        <div class="t" style="font-size:74px">NAMEPLATE</div>
      </div>
      <div class="s" style="font-size:22px;margin-left:auto;text-align:right">One mystery player a day.<br>Same player for everyone.</div>
    </div>
    <div style="margin-top:auto;display:flex;flex-direction:column;gap:${SIZE.gap}px">
      ${row(GUESSES[0])}
      ${row(GUESSES[1])}
      <div style="filter:drop-shadow(0 8px 26px rgba(62,203,120,.45))">${row(GUESSES[2])}</div>
    </div>
  </div>`);

// The site-wide fallback, unchanged: no board, because it fronts the
// whole site rather than the one game.
const DEFAULT = shell(`
  <div style="display:flex;align-items:center;gap:56px;padding:0 80px;height:630px">
    <img src="data:image/png;base64,${logo}" style="width:260px;height:260px;flex-shrink:0">
    <div style="position:relative;min-width:0">
      <div class="k" style="font-size:22px;margin-bottom:14px">SIDELINE BREW</div>
      <div class="t" style="font-size:104px">PICK&rsquo;EM</div>
      <div class="s" style="font-size:30px;margin-top:20px">Picks, tier lists and a daily game.<br>sidelinebrew.com</div>
    </div>
  </div>`);

const CARDS = [
  { file: "og-daily.png", html: DAILY },
  { file: "og-default.png", html: DEFAULT },
];

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined });
let failed = false;

for (const card of CARDS) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(card.html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // An OG image is a fixed frame: anything past it is simply cut, with no
  // error and nothing to notice until somebody shares the link. This
  // caught the title running underneath the board on an earlier layout,
  // which a check that only looked at the chips had passed.
  const spill = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => {
        if (el.classList.contains("glow")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > 1201 || r.left < -1 || r.bottom > 631 || r.top < -1);
      })
      .map((el) => `${el.className || el.tagName}: ${(el.textContent || "").trim().slice(0, 24)}`)
  );
  const clipped = await page.evaluate(() =>
    [...document.querySelectorAll(".plate b, .chip")]
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .map((el) => el.textContent.trim())
  );

  const buf = await page.screenshot({ type: "png" });
  await page.close();

  if (spill.length || clipped.length) {
    failed = true;
    console.error(`${card.file}: NOT written`);
    if (spill.length) console.error(`  past the 1200x630 frame: ${spill.join(", ")}`);
    if (clipped.length) console.error(`  text clipped inside its box: ${clipped.join(", ")}`);
    continue;
  }

  writeFileSync(join(PUBLIC, card.file), buf);
  console.log(`${card.file.padEnd(16)} ${Math.round(buf.length / 1024)}KB`);
}

await browser.close();
if (failed) {
  console.error("\nOne or more cards were not written - fix the layout above and run again.");
  process.exit(1);
}
console.log("\nBoth cards written to public/. Commit them: they are served as files, not rendered.");
