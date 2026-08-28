// Builds one page showing every reminder email, for sharing or for
// looking at on a phone.
//
//   npm run email:preview && node scripts/build-email-artifact.mjs
//
// Why this exists next to preview-emails.mjs rather than inside it: that
// script writes files meant to be opened locally, one per case, and an
// index that loads them by relative path. This writes a SINGLE
// self-contained file - every email inlined into an iframe srcdoc, the
// logo already a data URI - which is what you need to send somebody a
// link, drop it in a message, or open it somewhere that is not a
// checkout of this repo.
//
// It renders nothing itself. The four files it reads are the sender's
// own output, so this cannot show a design the sender does not send.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IN = join(ROOT, ".email-preview");
const OUT = process.argv[2] ?? join(IN, "artifact.html");

const CASES = [
  { file: "1-headsup-nothing-picked", eyebrow: "Heads-up · a day out", label: "Nothing picked at all" },
  { file: "2-headsup-partly-done", eyebrow: "Heads-up · a day out", label: "Most of the card done" },
  { file: "3-lastcall-nothing-picked", eyebrow: "Last call · inside the hour", label: "Nothing picked at all" },
  { file: "4-lastcall-one-left", eyebrow: "Last call · inside the hour", label: "One game left" },
];

if (!existsSync(join(IN, `${CASES[0].file}.html`))) {
  console.error("No rendered emails found. Run `npm run email:preview` first.");
  process.exit(1);
}

const attr = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Bungee inlined rather than linked. It is the site's display face, and
// a linked stylesheet is a request that can fail - offline, behind a
// proxy, on a locked-down network - leaving the one thing that makes the
// page look like Sideline Brew set in Arial.
const BUNGEE = readFileSync(join(ROOT, "scripts", "assets", "bungee-latin.woff2")).toString("base64");

const cards = CASES.map((c) => {
  const html = readFileSync(join(IN, `${c.file}.html`), "utf8");
  const txt = readFileSync(join(IN, `${c.file}.txt`), "utf8");
  const subject = (txt.match(/^Subject: (.*)$/m) ?? [, ""])[1];
  const plain = txt.replace(/^Subject: .*\n\n/, "");
  return `  <section class="card">
    <header>
      <p class="eyebrow">${esc(c.eyebrow)}</p>
      <h2>${esc(c.label)}</h2>
      <p class="subject"><span>Subject</span> ${esc(subject)}</p>
    </header>
    <div class="frame"><iframe srcdoc="${attr(html)}" title="${attr(c.label)}" scrolling="no"></iframe></div>
    <details><summary>Plain-text version</summary><pre>${esc(plain)}</pre></details>
  </section>`;
}).join("\n");

writeFileSync(
  OUT,
  `<title>Pick Reminder Emails</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap">
<style>
@font-face{font-family:"Bungee";src:url(data:font/woff2;base64,${BUNGEE}) format("woff2");
  font-weight:400;font-style:normal;font-display:swap}
:root{--ground:#070e1c;--panel:#0e1b33;--line:#1b2947;--text:#f4f6fb;
  --muted:#93a3bd;--dim:#64748b;--green:#4ade80}
*{box-sizing:border-box}
body{margin:0;background:var(--ground);color:var(--text);
  font-family:"Geist",ui-sans-serif,system-ui,-apple-system,sans-serif;line-height:1.6;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1240px;margin:0 auto;padding:44px 20px 90px}
.kicker{font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;
  color:var(--green);margin:0 0 12px}
h1{font-family:"Bungee","Arial Black",sans-serif;font-weight:400;
  font-size:clamp(1.5rem,4.4vw,2.4rem);line-height:1.1;margin:0 0 14px;text-wrap:balance}
.dek{margin:0;max-width:66ch;color:var(--muted);font-size:15.5px}
.dek b{color:var(--text);font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(430px,100%),1fr));
  gap:26px;margin:36px 0 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;
  overflow:hidden;display:flex;flex-direction:column}
.card header{padding:16px 20px;border-bottom:1px solid var(--line)}
.eyebrow{margin:0;font-size:10.5px;font-weight:700;letter-spacing:.16em;
  text-transform:uppercase;color:var(--green)}
.card h2{margin:7px 0 0;font-size:16px;font-weight:700}
.subject{margin:7px 0 0;color:var(--muted);font-size:13px;line-height:1.5}
.subject span{display:inline-block;font-size:9.5px;font-weight:700;letter-spacing:.1em;
  text-transform:uppercase;color:var(--dim);border:1px solid var(--line);
  border-radius:4px;padding:1px 5px;margin-right:6px;vertical-align:1px}
.frame{background:#e9edf4}
iframe{display:block;width:100%;border:0;background:transparent}
details{border-top:1px solid var(--line)}
summary{cursor:pointer;padding:12px 20px;font-size:13px;color:var(--muted);
  list-style-position:inside}
summary:hover{color:var(--text)}
pre{margin:0;padding:0 20px 18px;white-space:pre-wrap;word-break:break-word;
  font-size:12.5px;line-height:1.65;color:var(--muted);
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
footer{margin:52px 0 0;padding:24px 0 0;border-top:1px solid var(--line);
  color:var(--dim);font-size:13.5px;max-width:78ch}
footer b{color:var(--muted);font-weight:600}
footer p{margin:0 0 12px}
</style>
<div class="wrap">
  <p class="kicker">Sideline Brew</p>
  <h1>The two pick reminders</h1>
  <p class="dek">Rendered from the sender's own templates &mdash; this is what goes out, not a
    mock-up of it. A day out you get the heads-up; if the card is still unfinished inside the
    final hour, you get the last call. Never both unless both are useful.
    <b>Nothing was sent.</b></p>
  <div class="grid">
${cards}
  </div>
  <footer>
    <p>Shown at two states each, because <b>nothing picked</b> reads differently from
      <b>one game left</b>. The plain-text version under each is what clients that refuse HTML
      show, and what some spam filters read first.</p>
    <p>The button goes to <b>/weekly</b> carrying <b>from=reminder</b>, which makes the page lead
      with sign-in for anyone arriving signed out &mdash; without it they would land on an empty
      card seconds after being told how many picks they had. It also carries UTM tags, so PostHog
      can say how many people each email actually brought back.</p>
  </footer>
</div>
<script>
// Fit each frame to its own email. A fixed height either clips the
// longest or leaves a slab of white under the shortest, and a slab of
// white reads as part of the email.
function fit(){for(const f of document.querySelectorAll("iframe")){const d=f.contentDocument;
  if(d&&d.body)f.style.height=Math.ceil(d.documentElement.getBoundingClientRect().height)+"px";}}
addEventListener("load",fit);addEventListener("resize",fit);fit();
</script>`,
);

console.log(`Wrote ${OUT}`);
