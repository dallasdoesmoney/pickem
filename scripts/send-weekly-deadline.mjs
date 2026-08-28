// Emails people whose picks are unfinished, a day before the week locks.
//
//   DRY_RUN=1 node scripts/send-weekly-deadline.mjs
//
// Runs hourly through game day and sends nothing on almost every run.
// That is the design: rather than encoding "Sunday at 11am" in a cron
// line that goes wrong the first time a week opens with a Thursday game,
// this asks the schedule when the week actually locks and only acts
// inside a window before it.
//
// WHAT THIS DELIBERATELY CANNOT DO. It holds a token that is good for
// exactly two calls - list who still needs telling, and record that they
// were told - and the plain anon key. It cannot read another table, it
// cannot write anything else, and it never sees the service role key.
// See supabase/migrations/0052_email_reminders.sql.
//
// Sending at most once per person per week is the DATABASE's job, not
// this script's: email_sends has a unique constraint and the recipient
// query excludes anyone already in it. A crash halfway through, a double
// cron fire, a manual re-run - none of them can send the same person the
// same reminder twice.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseGames } from "./sync-results.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// How close to kickoff counts as "about to lock".
//
// A DAY, not a few hours. The cron runs hourly, the ledger allows one
// email per person per week, so the send happens on the first run where
// kickoff is within this many hours - which at 24 puts it roughly a day
// out, with time to actually go and make the picks.
//
// The consequence to keep in mind: this is a heads-up, not a last call.
// Somebody who reads it a day early and still has not picked an hour
// before kickoff gets nothing further, because they are already in the
// ledger for that week. Adding a genuine last call later means a second
// kind - the ledger is keyed on (user, kind, week), so a second row with
// a different kind coexists with this one rather than being swallowed by
// it.
//
// Guarded rather than `Number(env ?? 24)`, because GitHub sets an unset
// workflow input to an EMPTY STRING, not to nothing - and Number("") is
// 0, which would leave the scheduled job with a zero-hour window and
// stop it ever sending, silently and forever. Anything absent, empty,
// non-numeric or not positive falls back to the default.
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS) > 0 ? Number(process.env.WINDOW_HOURS) : 24;

// The last call, inside the final hour. Deliberately not configurable
// from the workflow: widening the heads-up is a testing convenience,
// widening this would turn a last call into a second heads-up and mail
// people twice in an afternoon.
//
// A caveat worth knowing rather than discovering. The cron runs at the
// top of each hour, so the notice this produces lands between 0 and 60
// minutes before kickoff depending on the kickoff MINUTE - a 1:00 PM
// Sunday start gets a clean hour, a 8:20 PM Wednesday start gets twenty
// minutes. Running the cron every fifteen minutes is what would make
// "an hour" mean an hour.
const FINAL_HOURS = 1;

// THE HOLDOUT. Off by default, and deliberately so - it withholds a
// reminder from real people, which is a product decision rather than a
// measurement one.
//
// Why it is here at all: "did the reminders help?" cannot be answered by
// looking at the people who got one. Plenty of them would have finished
// their card anyway, and a report showing that 60% of emailed people
// went on to pick is compatible with the email doing everything and with
// it doing nothing. The only way to tell the two apart is to leave a
// comparable group alone and see whether they behave differently.
//
// Set HOLDOUT_PERCENT to (say) 20 in the workflow to switch it on. Read
// supabase/checks/email_impact.sql for what comes out, and read the
// group sizes there before the percentages - on a small list this takes
// several weeks to say anything, and two people out of three is not a
// result.
//
// Guarded the same way as WINDOW_HOURS: GitHub sets an unset input to an
// empty string, and Number("") is 0. Here 0 happens to be the safe
// default rather than a broken one, but the guard also catches a typo
// like "20%" or "twenty" that would otherwise become NaN and silently
// hold nobody back.
const HOLDOUT_PERCENT = (() => {
  const n = Number(process.env.HOLDOUT_PERCENT);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Above 50 the experiment costs more picks than it can be worth, and
  // 100 would be "stop sending reminders" written in a confusing way.
  return Math.min(Math.floor(n), 50);
})();

// Which side of the experiment somebody is on, for a given week.
//
// Deterministic, so an hourly cron re-running inside the window puts the
// same person on the same side every time - the ledger is not what keeps
// them there. Salted with the week, so it is a different draw each week
// and the same unlucky people are not silently the ones who never get
// reminders all season.
//
// A hash rather than Math.random for the determinism, and rather than
// something like the last hex digit of the uuid because that would tie
// the split to how uuids happen to be generated.
function inHoldout(userId, week) {
  if (HOLDOUT_PERCENT <= 0) return false;
  const digest = createHash("sha256").update(`${userId}:week${week}`).digest();
  return digest.readUInt32BE(0) % 100 < HOLDOUT_PERCENT;
}

const DRY_RUN = process.env.DRY_RUN === "1";

// CAN-SPAM requires a real postal address in commercial mail. It is an
// environment variable with no default on purpose: a placeholder address
// shipped by accident is worse than a job that refuses to run, because
// the first one is only discovered by a complaint.
const REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "EMAIL_SENDER_TOKEN", "EMAIL_FROM", "EMAIL_POSTAL_ADDRESS"];
if (!DRY_RUN) REQUIRED.push("RESEND_API_KEY");

const missing = REQUIRED.filter((k) => !process.env[k]);
// Only when actually run. Imported - by the preview, or a test - the
// templates are wanted without the environment a send needs, and
// exiting the process on import would take the importer down with it.
const RUNNING = Boolean(process.argv[1] && process.argv[1].endsWith("send-weekly-deadline.mjs"));
if (RUNNING && missing.length) {
  // Named, not just listed. A secret whose name does not match what the
  // workflow asks for resolves to an empty string with no warning from
  // GitHub, and "Missing: SUPABASE_URL" alone sends you looking for a
  // secret that is sitting right there under a different name - which is
  // exactly how the results sync failed unnoticed.
  console.error(`Missing: ${missing.join(", ")}`);
  console.error(
    "\nEach comes from a GitHub Actions secret of the same name (the two Supabase\n" +
      "ones also accept a NEXT_PUBLIC_ prefix). An empty value here means the secret\n" +
      "does not exist under the name the workflow asks for - check the exact spelling\n" +
      "at Settings > Secrets and variables > Actions.",
  );
  process.exit(1);
}

const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  EMAIL_SENDER_TOKEN,
  RESEND_API_KEY,
  EMAIL_FROM,
  EMAIL_POSTAL_ADDRESS,
} = process.env;
const SITE = (process.env.SITE_URL ?? "https://sidelinebrew.com").replace(/\/$/, "");

async function rpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function openWeeks() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/weeks?is_open=eq.true&select=week`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`weeks: ${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).map((r) => r.week);
}

// Eastern, because the NFL schedule is quoted in it and a reminder that
// says a different time from the one on the broadcast is worse than no
// reminder. Two formats rather than one string sliced up: the weekday is
// wanted on its own for the subject, and splitting a locale-formatted
// date on " at " is the kind of thing that works until it does not.
const FMT = {
  full: new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }),
  day: new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }),
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The site's own colours, read off globals.css and the components rather
// than invented here, so the email and the app cannot drift apart
// quietly. If one of these changes on the site, change it here too.
const C = {
  ground: "#070e1c", // globals.css --background
  green: "#4ade80", // the app's primary green
  deep: "#22c55e", // its darker partner, for small text on white
  red: "#ef4444", // wrong/urgent - the last call's eyebrow
  ink: "#0b1220",
  body: "#41506a",
  faint: "#9aa8bd",
  mute: "#7d8ca6",
  wash: "#eef1f6",
  hair: "#e6eaf1",
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// The horizontal logo - a WHITE wordmark, which is why it only ever
// appears on the dark band. public/press-logo.png is the same mark with
// a dark wordmark for light grounds; putting this one on white would
// render it invisible.
//
// Served from the site rather than attached or inlined: Gmail strips
// data: URIs on images, and a CID attachment means dealing with MIME by
// hand. The file is public/email-logo.png - the header logo trimmed,
// resized to 440px and quantised, 9.6KB against the original's 311KB,
// which otherwise would have been most of the message's weight.
const LOGO = `${SITE}/email-logo.png`;

// Where the button goes. Two things ride along:
//
// from=reminder is read by the weekly page, which uses it to lead with
// sign-in when the visitor is signed out - email gets read on phones,
// and picks live in the database, so somebody arriving signed out would
// otherwise see an EMPTY card seconds after being told they had 13 of 16
// picked. See src/app/weekly/page.tsx.
//
// The utm_* trio is what PostHog reads, and it is the only reason we can
// ever say how many people the reminder actually brought back. Campaign
// carries the week so weeks can be compared; content separates the
// heads-up from the last call, which is the comparison that decides
// whether the second email earns its place.
// Two forms on purpose. In an href every & has to be &amp; - a raw one
// starts an entity reference, and a parameter that happens to spell one
// (&copy, &reg, &not) is silently swallowed by the parser. Nothing here
// spells one today, which is exactly the kind of thing that stays true
// until somebody adds a parameter. The plain-text mail wants the raw
// URL, because there is no parser there to undo the escaping.
const ctaUrl = (week, final) =>
  `${SITE}/weekly?from=reminder` +
  `&utm_source=email&utm_medium=reminder` +
  `&utm_campaign=week${week}` +
  `&utm_content=${final ? "last_call" : "heads_up"}`;
const ctaHref = (week, final) => ctaUrl(week, final).replaceAll("&", "&amp;");

// The footer says "because you have an account", NOT "because you turned
// this on". Reminders are on by default as of migration 0053, so the
// second sentence would be false for almost everybody receiving it -
// and a recipient who is told they opted in when they did not reaches
// for the spam button rather than the unsubscribe link, which costs the
// sending domain instead of costing the list one address.
//
// It is also two lines rather than a paragraph. CAN-SPAM wants a working
// opt-out and a postal address; it does not want an essay, and an essay
// about leaving is an advertisement for leaving.
//
// A dark band for the brand and a light body for everything else. Not a
// style choice so much as a deliverability one: a fully dark email is
// re-coloured unpredictably by Gmail's and Outlook's own dark modes, and
// the version people actually see stops being the version anyone looked
// at. Tables and inline styles for the same reason - Outlook's renderer
// is Word, and it ignores most of what a browser understands.
function html({ name, made, total, week, locksAt, unsubUrl, final }) {
  const left = total - made;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${C.wash};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${final ? "Last chance - " : ""}Week ${week} locks ${esc(locksAt)}, ${left} ${left === 1 ? "pick" : "picks"} still open.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.wash};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:${SANS};">
    <tr><td style="background:${C.ground};padding:22px 30px;">
      <img src="${LOGO}" width="200" alt="Sideline Brew" style="display:block;border:0;width:200px;height:auto;">
    </td></tr>
    <tr><td style="height:4px;background:${C.green};font-size:0;line-height:0;">&nbsp;</td></tr>
    <tr><td style="padding:32px 30px 0;">
      <div style="color:${final ? C.red : C.deep};font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">${
        final ? "Last call" : `Week ${week}`
      }</div>
      <h1 style="margin:10px 0 0;color:${C.ink};font-size:26px;line-height:1.25;font-weight:800;">${
        final ? "Your picks lock within the hour" : `Your picks lock ${esc(locksAt)}`
      }</h1>
      <p style="color:${C.body};font-size:16px;line-height:1.6;margin:14px 0 0;">
        ${esc(name)}, you have <strong style="color:${C.ink};">${made} of ${total}</strong> picked${
          made === 0 ? " - the whole card is still open." : `, so ${left} ${left === 1 ? "game is" : "games are"} still open.`
        }${final ? ` Anything unpicked at ${esc(locksAt)} stays unpicked.` : ""}
      </p>
    </td></tr>
    <tr><td style="padding:26px 30px 34px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${C.green};border-radius:10px;">
        <a href="${ctaHref(week, final)}" style="display:inline-block;padding:15px 32px;color:#06210f;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:.02em;">${
          final ? "Pick them now" : "Finish my picks"
        }</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="border-top:1px solid ${C.hair};padding:18px 30px 24px;">
      <p style="margin:0;color:${C.faint};font-size:11px;line-height:1.7;">
        ${esc(EMAIL_POSTAL_ADDRESS)}<br>
        <a href="${unsubUrl}" style="color:${C.mute};text-decoration:underline;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function text({ name, made, total, week, locksAt, unsubUrl, final }) {
  return [
    final ? `Week ${week} locks within the hour - ${locksAt}.` : `Week ${week} locks ${locksAt}.`,
    "",
    `${name}, you have ${made} of ${total} picked.`,
    "",
    `Finish them: ${ctaUrl(week, final)}`,
    "",
    `You are getting this because you have a Sideline Brew account.`,
    `Unsubscribe: ${unsubUrl}`,
    "",
    EMAIL_POSTAL_ADDRESS,
  ].join("\n");
}

async function send(to, subject, body, unsubUrl) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html: body.html,
      text: body.text,
      // The header form, so a mail client can offer its own unsubscribe
      // button instead of making somebody hunt the footer for the link.
      headers: { "List-Unsubscribe": `<${unsubUrl}>` },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return (await res.json())?.id ?? null;
}

async function main() {
  const games = parseGames(readFileSync(join(ROOT, "src", "data", "games.ts"), "utf8"));
  if (games.length < 200) {
    throw new Error(
      `Only parsed ${games.length} games out of src/data/games.ts - a full season is 272. ` +
        `Fix the parser rather than emailing people a made-up deadline.`,
    );
  }

  const open = await openWeeks();
  if (open.length === 0) return console.log("No week is open. Nothing to do.");
  const week = Math.max(...open);

  const weekGames = games.filter((g) => g.week === week && g.kickoff);
  if (weekGames.length === 0) throw new Error(`Week ${week} is open but has no games with a kickoff time.`);
  const total = games.filter((g) => g.week === week).length;

  const first = weekGames
    .map((g) => new Date(g.kickoff))
    .sort((a, b) => a - b)[0];
  const hoursOut = (first.getTime() - Date.now()) / 3_600_000;

  if (hoursOut <= 0) return console.log(`Week ${week} has already started (${hoursOut.toFixed(1)}h). Nothing to do.`);
  if (hoursOut > WINDOW_HOURS)
    return console.log(`Week ${week} locks in ${hoursOut.toFixed(1)}h, outside the ${WINDOW_HOURS}h window. Nothing to do.`);

  // Which of the two this run is. Inside the final hour it is the last
  // call; otherwise it is the day-out heads-up. Both are excluded
  // independently by the ledger, so a run inside the final hour sends
  // the last call to somebody who already had the heads-up, and sends
  // nothing to somebody who has already had both.
  //
  // The heads-up is NOT re-sent inside the final hour: anybody still
  // unpicked at that point already received it a day ago, so they are in
  // the ledger for that kind and fall out of the query on their own.
  const final = hoursOut <= FINAL_HOURS;
  const kind = final ? "weekly_deadline_final" : "weekly_deadline";

  const locksAt = FMT.full.format(first);
  const locksDay = FMT.day.format(first);
  console.log(
    `Week ${week} locks ${locksAt} - ${hoursOut.toFixed(1)}h out. ${total} games. Sending the ${
      final ? "LAST CALL" : "day-out heads-up"
    }.`,
  );

  const recipients = await rpc("weekly_deadline_recipients", {
    p_token: EMAIL_SENDER_TOKEN,
    p_week: week,
    p_total_games: total,
    p_kind: kind,
  });
  if (!recipients?.length) return console.log("Nobody to tell - everybody opted in has finished, or was told already.");

  // Split off the holdout before anything is sent. See HOLDOUT_PERCENT
  // above for why this exists; the short version is that "did the
  // reminder help" cannot be answered by looking only at people who got
  // one.
  const holdout = recipients.filter((r) => inHoldout(r.user_id, week));
  const audience = recipients.filter((r) => !inHoldout(r.user_id, week));
  if (HOLDOUT_PERCENT > 0) {
    console.log(
      `${recipients.length} eligible - ${audience.length} to tell, ${holdout.length} held back ` +
        `(${HOLDOUT_PERCENT}% holdout).`,
    );
  } else {
    console.log(`${recipients.length} to tell.`);
  }

  const sent = [];
  for (const r of audience) {
    const unsubUrl = `${SITE}/unsubscribe?t=${r.unsub_token}`;
    const view = { name: r.display_name, made: r.made, total, week, locksAt, unsubUrl, final };
    const left = total - r.made;
    const subject = final
      ? `Last call - Week ${week} locks within the hour, ${left} ${left === 1 ? "pick" : "picks"} open`
      : `Week ${week} locks ${locksDay} - ${left} ${left === 1 ? "pick" : "picks"} still open`;

    if (DRY_RUN) {
      console.log(`  [dry run] ${r.email} - "${subject}" (${r.made}/${total})`);
      continue;
    }
    try {
      const messageId = await send(r.email, subject, { html: html(view), text: text(view) }, unsubUrl);
      // Kept because it is the only join back to what happened next -
      // delivered, bounced, complained. It cannot be recovered later.
      sent.push({ user_id: r.user_id, message_id: messageId, picks_at_send: r.made });
    } catch (err) {
      // One bad address must not cost everybody else their reminder, and
      // it must not be recorded as sent - an unrecorded failure gets
      // retried on the next run, which is the right way round.
      console.error(`  FAILED ${r.email}: ${err.message}`);
    }
  }

  if (DRY_RUN) {
    for (const r of holdout) console.log(`  [dry run] HELD BACK ${r.email} (${r.made}/${total})`);
    return console.log("\nDry run - nothing sent, nothing recorded.");
  }

  // Record the holdout too, once per person per week. Without a row
  // there is nothing to compare against later: "who did we deliberately
  // not email in week 3" is not recoverable after the fact, because the
  // percentage could change and the eligible set moves as people pick.
  //
  // Kind is weekly_deadline_holdout, which the recipient query does not
  // filter on - so this row does not affect who gets mail. Holding
  // somebody back is decided by inHoldout() on every run, which is
  // deterministic, so they stay held back all week without needing the
  // ledger to remember. The unique constraint makes this idempotent.
  if (holdout.length) {
    const n = await rpc("mark_emails_sent", {
      p_token: EMAIL_SENDER_TOKEN,
      p_kind: "weekly_deadline_holdout",
      p_reference_id: String(week),
      p_rows: holdout.map((r) => ({ user_id: r.user_id, message_id: null, picks_at_send: r.made })),
    });
    console.log(`Held back ${holdout.length}, newly recorded ${n}.`);
  }

  if (sent.length) {
    // After Resend accepts, never before. A crash between the two costs a
    // possible duplicate; recording first would silently swallow the
    // reminder somebody was owed.
    const n = await rpc("mark_emails_sent", {
      p_token: EMAIL_SENDER_TOKEN,
      p_kind: kind,
      p_reference_id: String(week),
      p_rows: sent,
    });
    console.log(`Sent ${sent.length}, recorded ${n}.`);
  }
  if (sent.length !== audience.length) {
    console.error(`${audience.length - sent.length} failed and will be retried on the next run.`);
    process.exitCode = 1;
  }
}

// Importable without running, the way sync-results.mjs does it. The
// preview script imports html() and text() from here so that what it
// shows IS what goes out - and importing must not start a send.
if (process.argv[1] && process.argv[1].endsWith("send-weekly-deadline.mjs")) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

export { html, text };
