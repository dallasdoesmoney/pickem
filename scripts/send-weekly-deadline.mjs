// Emails people whose picks are unfinished, shortly before the week locks.
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
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseGames } from "./sync-results.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// How close to kickoff counts as "about to lock". Wide enough that an
// hourly cron cannot step over it, narrow enough that the mail is
// genuinely urgent when it lands.
const WINDOW_HOURS = Number(process.env.WINDOW_HOURS ?? 3);

const DRY_RUN = process.env.DRY_RUN === "1";

// CAN-SPAM requires a real postal address in commercial mail. It is an
// environment variable with no default on purpose: a placeholder address
// shipped by accident is worse than a job that refuses to run, because
// the first one is only discovered by a complaint.
const REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "EMAIL_SENDER_TOKEN", "EMAIL_FROM", "EMAIL_POSTAL_ADDRESS"];
if (!DRY_RUN) REQUIRED.push("RESEND_API_KEY");

const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
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

// A dark band for the brand and a light body for everything else. Not a
// style choice so much as a deliverability one: a fully dark email is
// re-coloured unpredictably by Gmail's and Outlook's own dark modes, and
// the version people actually see stops being the version anyone looked
// at. Tables and inline styles for the same reason - Outlook's renderer
// is Word, and it ignores most of what a browser understands.
function html({ name, made, total, week, locksAt, unsubUrl }) {
  const left = total - made;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#eef1f6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Week ${week} locks ${esc(locksAt)} - ${left} ${left === 1 ? "pick" : "picks"} still open.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="background:#070e1c;padding:20px 26px;">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:.02em;">Sideline Brew</div>
    </td></tr>
    <tr><td style="padding:28px 26px 8px;">
      <div style="color:#0b1220;font-size:22px;font-weight:700;line-height:1.3;">Week ${week} locks ${esc(locksAt)}</div>
      <p style="color:#41506a;font-size:15px;line-height:1.6;margin:14px 0 0;">
        ${esc(name)}, you have <strong style="color:#0b1220;">${made} of ${total}</strong> picked${
          made === 0 ? " - the whole card is still open." : `, so ${left} ${left === 1 ? "game is" : "games are"} still open.`
        }
      </p>
    </td></tr>
    <tr><td style="padding:22px 26px 6px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#3ecb78;border-radius:9px;">
        <a href="${SITE}/weekly" style="display:inline-block;padding:13px 26px;color:#06210f;font-size:15px;font-weight:700;text-decoration:none;">Finish my picks</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:20px 26px 26px;">
      <p style="color:#7d8ca6;font-size:12px;line-height:1.6;margin:0;">
        You are getting this because you turned on pick reminders.
        <a href="${unsubUrl}" style="color:#41506a;">Unsubscribe</a> - it takes one click and nothing else changes.
      </p>
      <p style="color:#9aa8bd;font-size:11px;line-height:1.6;margin:12px 0 0;">${esc(EMAIL_POSTAL_ADDRESS)}</p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function text({ name, made, total, week, locksAt, unsubUrl }) {
  return [
    `Week ${week} locks ${locksAt}.`,
    "",
    `${name}, you have ${made} of ${total} picked.`,
    "",
    `Finish them: ${SITE}/weekly`,
    "",
    `You are getting this because you turned on pick reminders.`,
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

  const locksAt = FMT.full.format(first);
  const locksDay = FMT.day.format(first);
  console.log(`Week ${week} locks ${locksAt} - ${hoursOut.toFixed(1)}h out. ${total} games.`);

  const recipients = await rpc("weekly_deadline_recipients", {
    p_token: EMAIL_SENDER_TOKEN,
    p_week: week,
    p_total_games: total,
  });
  if (!recipients?.length) return console.log("Nobody to tell - everybody opted in has finished, or was told already.");
  console.log(`${recipients.length} to tell.`);

  const sent = [];
  for (const r of recipients) {
    const unsubUrl = `${SITE}/unsubscribe?t=${r.unsub_token}`;
    const view = { name: r.display_name, made: r.made, total, week, locksAt, unsubUrl };
    const left = total - r.made;
    const subject = `Week ${week} locks ${locksDay} - ${left} ${left === 1 ? "pick" : "picks"} still open`;

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

  if (DRY_RUN) return console.log("\nDry run - nothing sent, nothing recorded.");

  if (sent.length) {
    // After Resend accepts, never before. A crash between the two costs a
    // possible duplicate; recording first would silently swallow the
    // reminder somebody was owed.
    const n = await rpc("mark_emails_sent", {
      p_token: EMAIL_SENDER_TOKEN,
      p_kind: "weekly_deadline",
      p_reference_id: String(week),
      p_rows: sent,
    });
    console.log(`Sent ${sent.length}, recorded ${n}.`);
  }
  if (sent.length !== recipients.length) {
    console.error(`${recipients.length - sent.length} failed and will be retried on the next run.`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
