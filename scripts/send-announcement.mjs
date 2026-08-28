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

// A test send: one email to one address, and NOTHING else happens.
//
// The database is not asked who the recipients are and the ledger is not
// written, so a test cannot consume the real campaign - which matters
// because announcement_recipients excludes anybody already in the ledger
// for this kind, permanently. Testing by sending "just to me" through
// the normal path would quietly mean the sender never mails you the real
// one.
const TEST_TO = (process.env.TEST_TO ?? "").trim();

// Asking for a test and not getting one has to be an ERROR, never a
// quiet fall-through to the real thing. Ticking "test send" in the
// workflow without EMAIL_TEST_TO configured leaves TEST_TO empty, and
// without this the script would shrug and mail the entire list - the
// exact opposite of what was asked for, at the worst possible moment.
if (process.env.TEST_SEND === "1" && !TEST_TO) {
  console.error(
    "Test send was requested but there is no address to send to.\n\n" +
      "Add a repository secret EMAIL_TEST_TO with your email, or type one into\n" +
      "the test_to box when you run the workflow. Refusing to fall back to the\n" +
      "real send.",
  );
  process.exit(1);
}
if (TEST_TO && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(TEST_TO)) {
  console.error(`TEST_TO does not look like an email address: "${TEST_TO}"`);
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

// WHAT EMAIL_FROM HAS TO CONTAIN, and why it cannot just be a name.
//
// `From` is a single header carrying an optional display name AND a
// mandatory address - "Sideline Brew <picks@sidelinebrew.com>". The
// address is what actually routes the mail and what the receiving server
// checks against SPF and DKIM; the name is decoration on top of it.
// There is no second field to put the address in, so a name on its own
// is not a From line, it is half of one.
//
// Two failure modes, and they deserve different treatment:
//
//   No @ at all      BROKEN. Resend rejects it with a 422, but not until
//                    the first send is attempted - so on a real run that
//                    surfaces as every address failing in turn, which
//                    reads like a delivery problem rather than a typo in
//                    a secret. Caught here instead, before anything is
//                    contacted.
//
//   Address, no name WORKS, looks worse. The inbox shows the raw address
//                    where the sender's name belongs. Warned rather than
//                    refused, because the mail is fine - but warned
//                    loudly, since the name beside a subject line is most
//                    of what decides whether anybody opens it, and the
//                    value is masked in the workflow log so there is
//                    nowhere to notice it except an actual inbox.
const FROM = (EMAIL_FROM ?? "").trim();
if (FROM && !FROM.includes("@")) {
  console.error(
    `EMAIL_FROM has no email address in it: "${FROM}"\n\n` +
      "A From line needs the address as well as the name - the address is what\n" +
      "routes the mail and what gets checked against your domain's DNS. Set the\n" +
      "secret to both, in this shape:\n\n" +
      `  ${FROM} <picks@sidelinebrew.com>\n\n` +
      "using whichever address on sidelinebrew.com you verified in Resend.",
  );
  process.exit(1);
}
if (FROM && !/<[^>]+@[^>]+>$/.test(FROM)) {
  console.warn(
    `\nWARNING: EMAIL_FROM is a bare address, so the inbox will show "${FROM}"\n` +
      "where the sender's name belongs. Set the secret to include one:\n" +
      `  Sideline Brew <${FROM}>\n`,
  );
}


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

  if (TEST_TO) {
    // The unsubscribe link carries an all-zero token on purpose. A real
    // one would let a test email actually unsubscribe somebody, and the
    // /unsubscribe page already handles an unknown token gracefully - it
    // says the link did not match anything, which is true.
    const view = {
      playUrl: `${SITE}/daily?from=announcement&utm_source=email&utm_medium=announcement&utm_campaign=${CAMPAIGN}`,
      unsubUrl: `${SITE}/unsubscribe?t=00000000-0000-0000-0000-000000000000`,
      addr: EMAIL_POSTAL_ADDRESS,
      logo: `${SITE}/email-logo.png`,
    };
    console.log(`\nTEST SEND to ${TEST_TO}`);
    console.log("Nobody else is contacted, and NOTHING is recorded - the real send still");
    console.log("reaches everyone, including this address.");
    console.log("The unsubscribe link in a test carries a dummy token and will not work.");
    if (DRY_RUN) return console.log("\nDry run - nothing sent.");
    const messageId = await send(TEST_TO, SUBJECT, { html: html(view), text: text(view) }, view.unsubUrl);
    return console.log(`\nSent. Resend message id: ${messageId ?? "(none returned)"}`);
  }

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
