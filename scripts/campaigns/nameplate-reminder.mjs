// CAMPAIGN: a nudge to go and play today's Nameplate.
//
// Deliberately a fraction of the length of nameplate-launch.mjs. That
// one had to teach the game to somebody who had never seen it - three
// numbered steps, a worked board, a colour key. This one is written for
// somebody who already knows what it is and simply has not opened it
// today, and the only job of a reminder is to be one tap from the thing.
// Every paragraph past that is a paragraph somebody scrolls.
//
// WHAT IT CANNOT SAY. The sender is given a list of addresses and
// nothing else - no play history, by design - so this email does not
// know whether you already played today. That rules out the obvious
// line, "you haven't played yet", which would be wrong for everybody who
// had and is exactly the kind of wrong that gets a sender muted. So the
// copy is true either way: today's player is up, here is the door.

// The launch email's palette, imported rather than copied - two files
// spelling the same greens is two files that drift.
import { B } from "./nameplate-launch.mjs";

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "'Bungee','Arial Black','Helvetica Neue',Impact,Arial,sans-serif";

// THE SHARE GRID, which is the one picture of this game that gives
// nothing away. Four rows of six, closing on a row of green: somebody
// solved it in four. No name, no team, no column headings - the same
// thing a player would post, and the reason the game is shareable at
// all.
//
// Table cells rather than an image, for the same reason the launch
// email built its board out of cells: an email whose only picture is an
// image is a blank rectangle in every client that blocks them, which is
// most of Outlook and a good slice of Gmail. Cells always draw.
const TONE = { hit: "#3ecb78", close: "#ffce3a", miss: "#c8d0dc" };
const GRID = [
  ["miss", "miss", "close", "miss", "close", "miss"],
  ["miss", "close", "hit", "miss", "hit", "close"],
  ["hit", "close", "hit", "close", "hit", "hit"],
  ["hit", "hit", "hit", "hit", "hit", "hit"],
];

const grid = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:0 auto;">
  ${GRID.map(
    (row) => `<tr>${row
      .map(
        (v) => `<td style="padding:0 4px 4px 0;">
        <div style="width:26px;height:26px;border-radius:6px;background:${TONE[v]};font-size:0;line-height:0;">&nbsp;</div></td>`,
      )
      .join("")}</tr>`,
  ).join("")}
</table>`;

// Two lines, not five. A streak is the reason a daily game is a daily
// game, and "same player for everyone" is the reason it is worth
// arguing about - those are the two, and anything else here is padding
// on an email that exists to be closed.
const WHY = [
  ["🔥", "Your streak is counting", "Miss a day and it goes back to zero. Nothing else on the site keeps score like it."],
  ["🟩", "Everybody gets the same player", "So the only question is who needed fewer guesses. Results share as squares &mdash; no spoilers."],
];

const why = WHY.map(
  ([icon, title, body]) => `<tr>
    <td width="30" valign="top" style="padding:0 12px 14px 0;font-size:18px;line-height:1.2;">${icon}</td>
    <td valign="top" style="padding:0 0 14px;">
      <div style="color:${B.ink};font-size:15px;font-weight:700;line-height:1.35;">${title}</div>
      <div style="margin-top:3px;color:${B.body};font-size:14px;line-height:1.55;">${body}</div>
    </td>
  </tr>`,
).join("");

export function html({ playUrl, unsubUrl, addr, logo }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${B.wash};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">A new player every night at midnight ET. Today&rsquo;s takes about a minute.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.wash};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:${SANS};">

    <tr><td style="background:${B.ground};padding:22px 30px 28px;">
      <img src="${logo}" width="180" alt="Sideline Brew" style="display:block;border:0;width:180px;height:auto;">
      <div style="margin:24px 0 0;color:${B.green};font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;">Today&rsquo;s board is up</div>
      <div style="margin:8px 0 0;color:#ffffff;font-family:${DISPLAY};font-weight:900;font-size:44px;line-height:1;letter-spacing:-.01em;">NAMEPLATE</div>
      <p style="margin:14px 0 0;color:#c3cfe2;font-size:16px;line-height:1.55;">
        A new mystery NFL player went up at midnight. Eight guesses, about a minute.
      </p>
    </td></tr>
    <tr><td style="height:4px;background:${B.green};font-size:0;line-height:0;">&nbsp;</td></tr>

    <!-- THE BUTTON COMES FIRST, above everything else. A reminder that
         makes somebody scroll to find the door has already failed at the
         only thing it was sent to do. -->
    <tr><td align="center" style="padding:28px 30px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${B.green};border-radius:10px;">
        <a href="${playUrl}" style="display:inline-block;padding:16px 40px;color:#06210f;font-size:16px;font-weight:800;text-decoration:none;letter-spacing:.02em;">Play today&rsquo;s player</a>
      </td></tr></table>
    </td></tr>

    <tr><td align="center" style="padding:26px 20px 0;">
      ${grid}
      <p style="margin:12px 0 0;color:${B.mute};font-size:12px;line-height:1.6;">
        Somebody got it in four. That is all a shared result says &mdash; no name, no team.
      </p>
    </td></tr>

    <tr><td style="padding:26px 30px 0;">
      <div style="height:1px;background:${B.hair};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>
    <tr><td style="padding:22px 30px 4px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${why}</table>
    </td></tr>

    <tr><td style="padding:8px 30px 30px;">
      <p style="margin:0;color:${B.mute};font-size:13px;line-height:1.6;text-align:center;">
        Free, no app, and it resets every night at midnight ET.
      </p>
    </td></tr>

    <tr><td style="border-top:1px solid ${B.hair};padding:18px 30px 24px;">
      <p style="margin:0;color:${B.faint};font-size:11px;line-height:1.7;">
        ${addr}<br>
        <a href="${unsubUrl}" style="color:${B.mute};text-decoration:underline;">Unsubscribe</a>
      </p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

export function text({ playUrl, unsubUrl, addr }) {
  return [
    "NAMEPLATE - today's board is up",
    "",
    "A new mystery NFL player went up at midnight. Eight guesses, about a",
    "minute.",
    "",
    `Play today's player: ${playUrl}`,
    "",
    "- Your streak is counting. Miss a day and it goes back to zero.",
    "- Everybody gets the same player, so the only question is who needed",
    "  fewer guesses. Results share as coloured squares - no name, no team,",
    "  no spoilers.",
    "",
    "Free, no app, and it resets every night at midnight ET.",
    "",
    `Unsubscribe: ${unsubUrl}`,
    "",
    addr,
  ].join("\n");
}

// Short enough to survive a phone inbox whole, and it says the one thing
// that makes somebody open it: there is a new one, today. The preheader
// carries the rest.
export const SUBJECT = "Today's Nameplate is up";
