// CAMPAIGN: week 2's board is open.
//
// One file per blast. Unlike the last one this is not a last call - it
// goes out with days to spare - so it leads with the board being up
// rather than with a clock. The Thursday game is named because it is the
// first thing that closes and the one people actually miss.
//
// TIME-BOUND: dead after Thursday 17 September 2026, 8:15 PM ET, which is
// when the first pick locks. Do not re-run it later; week 3 is a new
// file, not an edit to this one.
export const B = {
  ground: "#070e1c",
  panel: "#0e1b33",
  green: "#4ade80",
  deep: "#22c55e",
  ink: "#0b1220",
  body: "#41506a",
  faint: "#9aa8bd",
  mute: "#7d8ca6",
  hair: "#e6eaf1",
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "'Bungee','Arial Black','Helvetica Neue',Impact,Arial,sans-serif";

// Written out rather than formatted from a Date: a person deciding
// whether to send this can check a literal at a glance.
const OPENER = "Lions at Bills";
const OPENER_AT = "Thursday, 8:15 PM ET";

const POINTS = [
  [
    "Sixteen games",
    `It opens with ${OPENER} on ${OPENER_AT} and runs through Monday night.`,
  ],
  [
    "Each game locks at its own kickoff",
    "Thursday's pick closes Thursday. Everything else stays open - the Sunday games until Sunday, Monday night until Monday night.",
  ],
  [
    "Set your Lock of the Week",
    "One pick you are sure about, worth extra. You get one a week and it locks with its game like any other.",
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
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Sixteen games. ${OPENER} kicks off ${OPENER_AT} and that pick closes with it.</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${B.ground};">
<tr><td align="center" style="padding:26px 12px 34px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;font-family:${SANS};">

    <tr><td align="center" style="background:${B.panel};padding:22px 30px;">
      <img src="${logo}" alt="Sideline Brew" width="132" style="display:block;border:0;width:132px;height:auto;">
    </td></tr>

    <tr><td align="center" style="padding:30px 30px 0;">
      <p style="margin:0 0 8px;color:${B.deep};font-size:11px;letter-spacing:1.4px;font-family:${DISPLAY};">WEEK 2</p>
      <h1 style="margin:0;color:${B.ink};font-size:29px;line-height:1.2;font-family:${DISPLAY};">
        The board is up
      </h1>
      <p style="margin:12px 0 0;color:${B.body};font-size:15px;line-height:1.6;">
        Sixteen games, and the first one closes ${OPENER_AT}.
      </p>
    </td></tr>

    <tr><td align="center" style="padding:24px 30px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td align="center" bgcolor="${B.deep}" style="border-radius:999px;">
          <a href="${playUrl}" style="display:inline-block;padding:14px 34px;color:#ffffff;font-size:15px;text-decoration:none;font-family:${DISPLAY};">
            MAKE MY PICKS
          </a>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:28px 30px 0;">
      <div style="height:1px;background:${B.hair};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>

    <tr><td style="padding:22px 30px 6px;">
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
    "WEEK 2 - the board is up",
    "",
    `Sixteen games, and the first one closes ${OPENER_AT}.`,
    "",
    `Make your picks: ${playUrl}`,
    "",
    ...POINTS.flatMap(([head, rest]) => [`- ${head}: ${rest}`, ""]),
    `Unsubscribe: ${unsubUrl}`,
    "",
    addr,
  ].join("\n");
}

export const PATH = "/weekly";

// Says what happened, not what to do. "Make your picks" is the button's
// job; a subject line competing with it just spends the reader's
// attention twice.
export const SUBJECT = "Week 2 is open";
