// Sends a one-off announcement to everybody who wants game updates.
//
//   DRY_RUN=1 CAMPAIGN=nameplate-launch node scripts/send-announcement.mjs
//
// Separate from send-weekly-deadline.mjs on purpose. That one answers
// "whose card is unfinished with a deadline coming", asks the schedule
// what time it is, and runs on a cron. This one answers "who asked to
// hear about new games", has no schedule at all, and runs exactly when
// somebody presses the button. Sharing a script between them would mean
// one file trying to be two different things.
//
// WHAT THIS DELIBERATELY CANNOT DO. Same shape as the reminder: the
// EMAIL_SENDER_TOKEN is good for two calls - list who wants this, and
// record that they got it - and nothing else. No service role key.
//
// SENDING ONCE is the database's job, not this script's. email_sends has
// a unique constraint on (user_id, kind, reference_id) and
// announcement_recipients excludes anyone already in it, so a double
// click, a retry or a re-run cannot mail the same person twice.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.env.DRY_RUN === "1";

// Which campaign. No default: a blast that picks its own message when
// you forget to say which one is not a feature.
const CAMPAIGN = (process.env.CAMPAIGN ?? "").trim();
if (!CAMPAIGN) {
  const found = readdirSync(join(HERE, "campaigns"))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => `  ${f.replace(/\.mjs$/, "")}`)
    .join("\n");
  console.error(`Set CAMPAIGN to one of:\n${found}`);
  process.exit(1);
}
// The kind the ledger records, and the shape announcement_recipients
// insists on. Derived rather than typed twice - two places to spell the
// same campaign name is one place to spell it wrong, and a mismatch here
// would re-send to everybody.
const KIND = `announcement:${CAMPAIGN}`;
if (!/^announcement:[a-z0-9-]{3,60}$/.test(KIND)) {
  console.error(`Campaign name must be lowercase letters, digits and dashes: got "${CAMPAIGN}"`);
  process.exit(1);
}

const REQUIRED = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "EMAIL_SENDER_TOKEN", "EMAIL_FROM", "EMAIL_POSTAL_ADDRESS"];
if (!DRY_RUN) REQUIRED.push("RESEND_API_KEY");
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing: ${missing.join(", ")}`);
  console.error(
    "\nEach comes from a GitHub Actions secret of the same name (the two Supabase\n" +
      "ones also accept a NEXT_PUBLIC_ prefix). An empty value means the secret does\n" +
      "not exist under the name the workflow asks for - check the exact spelling at\n" +
      "Settings > Secrets and variables > Actions.",
  );
  process.exit(1);
}

const { SUPABASE_URL, SUPABASE_ANON_KEY, EMAIL_SENDER_TOKEN, RESEND_API_KEY, EMAIL_FROM, EMAIL_POSTAL_ADDRESS } =
  process.env;
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
  const campaign = await import(`./campaigns/${CAMPAIGN}.mjs`);
  const { html, text, SUBJECT } = campaign;
  if (typeof html !== "function" || typeof text !== "function" || !SUBJECT) {
    throw new Error(`campaigns/${CAMPAIGN}.mjs must export html(), text() and SUBJECT`);
  }

  console.log(`Campaign: ${KIND}`);
  console.log(`Subject:  ${SUBJECT}`);

  const recipients = await rpc("announcement_recipients", {
    p_token: EMAIL_SENDER_TOKEN,
    p_kind: KIND,
  });
  if (!recipients?.length) {
    return console.log("Nobody to tell - everybody who wants game updates has already had this one.");
  }
  console.log(`${recipients.length} to tell.`);

  const sent = [];
  for (const r of recipients) {
    const unsubUrl = `${SITE}/unsubscribe?t=${r.unsub_token}`;
    // The link carries the same tags as the reminder, so PostHog can
    // compare a launch blast against a deadline nudge rather than
    // lumping both under "email".
    const playUrl =
      `${SITE}/daily?from=announcement` +
      `&utm_source=email&utm_medium=announcement&utm_campaign=${CAMPAIGN}`;
    const view = { playUrl, unsubUrl, addr: EMAIL_POSTAL_ADDRESS, logo: `${SITE}/email-logo.png` };

    if (DRY_RUN) {
      console.log(`  [dry run] ${r.email}`);
      continue;
    }
    try {
      const messageId = await send(r.email, SUBJECT, { html: html(view), text: text(view) }, unsubUrl);
      sent.push({ user_id: r.user_id, message_id: messageId, picks_at_send: null });
    } catch (err) {
      // One bad address must not cost everybody else the announcement,
      // and it must not be recorded as sent - an unrecorded failure gets
      // retried on the next run, which is the right way round.
      console.error(`  FAILED ${r.email}: ${err.message}`);
    }
  }

  if (DRY_RUN) return console.log("\nDry run - nothing sent, nothing recorded.");

  if (sent.length) {
    // After Resend accepts, never before. A crash between the two costs
    // a possible duplicate; recording first would silently swallow the
    // email somebody was owed.
    //
    // reference_id is '1' rather than the campaign name: the kind
    // already carries that, and the ledger's unique constraint spans
    // both, so a constant here means "this campaign, once, ever".
    const n = await rpc("mark_emails_sent", {
      p_token: EMAIL_SENDER_TOKEN,
      p_kind: KIND,
      p_reference_id: "1",
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
