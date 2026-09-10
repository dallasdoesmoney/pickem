// CAMPAIGN: last call on the Thursday night game, week 1.
//
// One file per blast; the sender picks it up by name. Unlike the two
// before it this one is time-bound - it is about a specific kickoff on a
// specific night - so it is worth saying plainly that it is dead after
// 8:35 PM ET on 10 September 2026 and must not be re-run later.
//
// It also carries an actual change, which is the real reason to send it:
// picks used to stay editable until somebody closed the week by hand, and
// now every game closes itself the moment it kicks off. People need to
// know that, because the old behaviour was more forgiving and some of
// them will be relying on it.
//
// Deliberately no scoreboard, no board graphic, no logos beyond the
// masthead. It has one job and about four seconds to do it, and the
// Thursday game in week 1 is played in Melbourne at a time nobody has a
// habit for yet.
export const B = {
  ground: "#070e1c",
  panel: "#0e1b33",
  green: "#4ade80",
  deep: "#22c55e",
  amber: "#ffc21a",
  ink: "#0b1220",
  body: "#41506a",
  faint: "#9aa8bd",
  mute: "#7d8ca6",
  hair: "#e6eaf1",
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "'Bungee','Arial Black','Helvetica Neue',Impact,Arial,sans-serif";

// Written out rather than formatted from a Date: this file is read by a
// person deciding whether to send it, and a literal is checkable at a
// glance in a way `FMT.full.format(...)` is not.
const KICKOFF = "8:35 PM ET tonight";
const MATCHUP = "49ers at Rams";

// The two things that are true and were not true last week. Kept as data
// so the HTML and the plain-text version cannot drift apart - the text
// part is not a courtesy, it is what a good few clients actually render.
const POINTS = [
  [
    "Games lock themselves now",
    `Each game closes the moment it kicks off. ${MATCHUP} closes at ${KICKOFF} - after that, that one pick is final.`,
  ],
  [
    "The rest of week 1 stays open",
    "Only the game that has started locks. Your Sunday picks are open until Sunday, and Sunday night's until Sunday night.",
  ],
  [
    "Nobody has to close anything",
    "This used to wait on somebody flipping a switch. It does not any more, so a late pick on a game already being played is no longer possible.",
  ],
];

function bullets() {
  return POINTS.map(
    ([head, rest]) => `
      <tr><td style="padding:0 0 16px;">
        <p style="margin:0 0 3px;color:${B.ink};font-size:14px;line-height:1.5;font-weight:700;">${head}</p>
        <p style="margin:0;color:${B.body};font-size:14px;line-height:1.6;">${rest}</p>
      </td></tr>`,
  ).join("");
}

export function html({ playUrl, unsubUrl, addr, logo }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${B.ground};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${MATCHUP} pick is final at ${KICKOFF}. The rest of week 1 stays open.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${B.ground};">
<tr><td align="center" style="padding:26px 12px 34px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:${SANS};">

    <tr><td align="center" style="background:${B.panel};padding:22px 30px;">
      <img src="${logo}" alt="Sideline Brew" width="132" style="display:block;border:0;width:132px;height:auto;">
    </td></tr>

    <tr><td align="center" style="padding:30px 30px 0;">
      <p style="margin:0 0 8px;color:${B.deep};font-size:11px;letter-spacing:1.4px;font-family:${DISPLAY};">LAST CALL</p>
      <h1 style="margin:0;color:${B.ink};font-size:27px;line-height:1.2;font-family:${DISPLAY};">
        ${MATCHUP} locks at 8:35
      </h1>
      <p style="margin:12px 0 0;color:${B.body};font-size:15px;line-height:1.6;">
        Thursday night from Melbourne. Once it kicks off, that pick is
        locked &mdash; and this time the board means it.
      </p>
    </td></tr>

    <tr><td align="center" style="padding:24px 30px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" bgcolor="${B.deep}" style="border-radius:999px;">
          <a href="${playUrl}" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:15px;text-decoration:none;font-family:${DISPLAY};">
            CHECK MY PICKS
          </a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:28px 30px 0;">
      <div style="height:1px;background:${B.hair};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>

    <tr><td style="padding:22px 30px 6px;">
      <p style="margin:0 0 16px;color:${B.mute};font-size:11px;letter-spacing:1.2px;font-family:${DISPLAY};">WHAT CHANGED</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${bullets()}</table>
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
    `LAST CALL - ${MATCHUP} locks at 8:35`,
    "",
    "Thursday night from Melbourne. Once it kicks off, that pick is locked",
    "- and this time the board means it.",
    "",
    `Check your picks: ${playUrl}`,
    "",
    "WHAT CHANGED",
    "",
    ...POINTS.flatMap(([head, rest]) => [`- ${head}: ${rest}`, ""]),
    `Unsubscribe: ${unsubUrl}`,
    "",
    addr,
  ].join("\n");
}

// The board, not the daily game - every campaign before this one was
// about /nfl-nameplate, and the sender still defaults there.
export const PATH = "/weekly";

// Names the game rather than the deadline. "Your picks lock tonight" is
// what every other pick'em sends and reads as boilerplate; the matchup is
// the part somebody recognises in a notification.
export const SUBJECT = "49ers at Rams locks at 8:35";
