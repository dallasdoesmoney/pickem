// Writes every reminder email to an HTML file you can open in a browser.
//
//   node scripts/preview-emails.mjs
//
// Exists because there is nowhere else to look. The templates are
// JavaScript inside the sender, so the only way to see one used to be to
// send one - and the first time anybody sees a marketing email should
// not be the moment a few hundred people see it too.
//
// It sends nothing, talks to nothing, and needs no keys. The sender's
// own html() and text() are imported rather than copied, so what this
// renders IS what goes out; a preview built from a second copy of the
// template is a preview of the wrong thing the moment one of them
// changes.
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The sender refuses to run without its environment, and it checks that
// at import time. These are placeholders purely to get past that guard -
// nothing here is used to reach anything.
process.env.SUPABASE_URL ||= "https://preview.invalid";
process.env.SUPABASE_ANON_KEY ||= "preview";
process.env.EMAIL_SENDER_TOKEN ||= "preview";
process.env.EMAIL_FROM ||= "Sideline Brew <picks@sidelinebrew.com>";
process.env.EMAIL_POSTAL_ADDRESS ||= "123 Example Street, Your City, ST 00000";
process.env.DRY_RUN = "1";

const { html, text } = await import("./send-weekly-deadline.mjs");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, ".email-preview");
mkdirSync(OUT, { recursive: true });

// The real email points its logo at https://sidelinebrew.com/email-logo.png,
// which is right for a mail client and wrong for a preview: opened from
// a file:// path before a deploy, that URL is either the OLD logo or a
// 404, and a preview that quietly shows a stale image is worse than one
// that shows none. So the preview swaps in the file on disk. Everything
// else - every colour, every table, every word - is the sender's own.
const LOGO_DATA = `data:image/png;base64,${readFileSync(join(ROOT, "public", "email-logo.png")).toString("base64")}`;
const localLogo = (s) => s.replaceAll(`${process.env.SITE_URL ?? "https://sidelinebrew.com"}/email-logo.png`, LOGO_DATA);

// The cases worth looking at, not just the happy one. Nothing picked
// reads differently from one game left, and the last call says something
// the heads-up does not.
const CASES = [
  { file: "1-headsup-nothing-picked", label: "Heads-up, a day out - nothing picked at all",
    view: { name: "Dallas", made: 0, total: 16, week: 3, locksAt: "Sunday, 1:00 PM EST", final: false } },
  { file: "2-headsup-partly-done", label: "Heads-up, a day out - most of the card done",
    view: { name: "Dallas", made: 13, total: 16, week: 3, locksAt: "Sunday, 1:00 PM EST", final: false } },
  { file: "3-lastcall-nothing-picked", label: "Last call, inside the hour - nothing picked",
    view: { name: "Dallas", made: 0, total: 16, week: 3, locksAt: "Sunday, 1:00 PM EST", final: true } },
  { file: "4-lastcall-one-left", label: "Last call, inside the hour - one game left",
    view: { name: "Dallas", made: 15, total: 16, week: 3, locksAt: "Sunday, 1:00 PM EST", final: true } },
];

const UNSUB = "https://sidelinebrew.com/unsubscribe?t=00000000-0000-0000-0000-000000000000";

const index = [];
for (const c of CASES) {
  const view = { ...c.view, unsubUrl: UNSUB };
  const left = view.total - view.made;
  const subject = view.final
    ? `Last call - Week ${view.week} locks within the hour, ${left} ${left === 1 ? "pick" : "picks"} open`
    : `Week ${view.week} locks Sunday - ${left} ${left === 1 ? "pick" : "picks"} still open`;

  writeFileSync(join(OUT, `${c.file}.html`), localLogo(html(view)));
  writeFileSync(join(OUT, `${c.file}.txt`), `Subject: ${subject}\n\n${text(view)}`);
  index.push({ ...c, subject });
  console.log(`${c.file}.html   ${c.label}`);
  console.log(`    subject: ${subject}`);
}

// One page that shows all four in the frame a mail client gives them, so
// the whole set can be judged at once rather than four files at a time.
writeFileSync(
  join(OUT, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Reminder emails</title>
<style>
 body{margin:0;background:#0e1116;color:#e7ecf3;font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif}
 .wrap{max-width:1200px;margin:0 auto;padding:32px 20px 80px}
 h1{font-size:22px;margin:0 0 6px}
 p.note{color:#8b98a9;margin:0 0 28px}
 .row{display:grid;grid-template-columns:repeat(auto-fit,minmax(380px,1fr));gap:24px}
 .card{background:#161b22;border:1px solid #2a323d;border-radius:12px;overflow:hidden}
 .hd{padding:12px 14px;border-bottom:1px solid #2a323d}
 .hd b{display:block;font-size:13px}
 .hd span{display:block;color:#8b98a9;font-size:12px;margin-top:3px}
 iframe{display:block;width:100%;height:560px;border:0;background:#fff}
</style>
<div class="wrap">
<h1>Pick reminder emails</h1>
<p class="note">Rendered from the sender's own templates. Nothing was sent.</p>
<div class="row">
${index
  .map(
    (c) => `  <div class="card">
    <div class="hd"><b>${c.label}</b><span>Subject: ${c.subject}</span></div>
    <iframe src="./${c.file}.html" title="${c.label}"></iframe>
  </div>`,
  )
  .join("\n")}
</div></div>`,
);

console.log(`\nWritten to ${OUT}`);
console.log("Open .email-preview/index.html to see all four side by side.");
