// CAMPAIGN: the NFL Nameplate launch announcement.
//
// One file per blast. scripts/send-announcement.mjs picks it up by name,
// so a future announcement is a new file here rather than an edit to the
// sender - and an old one stays readable as a record of what went out.
//
// The NFL Nameplate launch announcement, as real email HTML.
//
// The board is built from TABLE CELLS, not an image, and that is the
// central decision here. An image would be easier and would match the OG
// card exactly - but a launch email whose entire point is "look at this
// game" becomes a blank rectangle for everybody whose client blocks
// images by default, which is most of Outlook and a good slice of Gmail.
// Cells always draw.
//
// Data lifted from src/app/page.tsx (DAILY_ANSWER / DAILY_GUESSES) and
// the verdicts recomputed with the same rules, so the email cannot show
// a board the site would disagree with.
export const B = {
  ground: "#070e1c",
  panel: "#0e1b33",
  green: "#4ade80",
  deep: "#22c55e",
  ink: "#0b1220",
  body: "#41506a",
  faint: "#9aa8bd",
  mute: "#7d8ca6",
  wash: "#eef1f6",
  hair: "#e6eaf1",
};

// The board's own palette - DAILY_TONE in src/app/page.tsx.
const TONE = { hit: "#3ecb78", close: "#ffce3a", miss: "#aab3c1" };
// Ink on each: all three are light, so the text is always the dark ground.
const TONE_INK = "#0b1220";

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = "'Bungee','Arial Black','Helvetica Neue',Impact,Arial,sans-serif";

const ANSWER = { team: "LAR", conf: "NFC", div: "NFC West", pos: "WR", age: 25, heightIn: 74, jersey: 12 };
const GUESSES = [
  { name: "Tee Higgins", team: "CIN", color: "#FB4F14", ink: "#ffffff",
    conf: "AFC", div: "AFC North", pos: "WR", age: 27, heightIn: 76, jersey: 5 },
  { name: "Chris Olave", team: "NO", color: "#D3BC8D", ink: "#0b1220",
    conf: "NFC", div: "NFC South", pos: "WR", age: 26, heightIn: 72, jersey: 12 },
  { name: "Puka Nacua", team: "LAR", color: "#003594", ink: "#ffffff",
    conf: "NFC", div: "NFC West", pos: "WR", age: 25, heightIn: 74, jersey: 12 },
];

const near = (a, b, within) => (a === b ? "hit" : Math.abs(a - b) <= within ? "close" : "miss");
const feet = (inches) => `${Math.floor(inches / 12)}'${inches % 12}"`;

function row(g) {
  return [
    { text: g.team, verdict: g.team === ANSWER.team ? "hit" : "miss" },
    // Two lines, the way the board and the share card set it: "AFC North"
    // on one line inside a 70px column is either four-point type or an
    // overflow.
    { text: g.div.replace(" ", "<br>"), verdict: g.div === ANSWER.div ? "hit" : g.conf === ANSWER.conf ? "close" : "miss" },
    { text: g.pos, verdict: g.pos === ANSWER.pos ? "hit" : "miss" },
    { text: String(g.age), verdict: near(g.age, ANSWER.age, 3) },
    { text: feet(g.heightIn), verdict: near(g.heightIn, ANSWER.heightIn, 2) },
    { text: String(g.jersey), verdict: near(g.jersey, ANSWER.jersey, 3) },
  ];
}

const HEADS = ["TEAM", "DIV", "POS", "AGE", "HT", "#"];

// One guess: the name on its team's colour, then six graded chips.
// Fixed widths rather than percentages - Outlook's table maths is Word's,
// and a percentage column inside a nested table is where it goes wrong.
function boardRow(g) {
  const cells = row(g)
    .map(
      (c) => `<td width="62" style="padding:0 3px 6px 0;">
        <div style="background:${TONE[c.verdict]};border-radius:6px;height:38px;line-height:1.05;
             color:${TONE_INK};font-size:12px;font-weight:800;text-align:center;
             display:table-cell;vertical-align:middle;width:62px;">${c.text}</div></td>`,
    )
    .join("");
  return `<tr>
    <td width="132" style="padding:0 3px 6px 0;">
      <div style="background:${g.color};border-radius:6px;height:38px;
           color:${g.ink};font-size:13px;font-weight:800;text-align:left;padding:0 10px;
           display:table-cell;vertical-align:middle;width:112px;">${g.name}</div></td>
    ${cells}
  </tr>`;
}

const header = `<tr>
  <td width="132"></td>
  ${HEADS.map(
    (h) => `<td width="62" style="padding:0 3px 5px 0;text-align:center;color:${B.faint};
       font-size:9px;font-weight:700;letter-spacing:.1em;">${h}</td>`,
  ).join("")}
</tr>`;

const board = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"
  style="border-collapse:separate;margin:0 auto;">
  ${header}
  ${GUESSES.map(boardRow).join("")}
</table>`;

const key = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
  <tr>
    ${[
      [TONE.hit, "Exact"],
      [TONE.close, "Close"],
      [TONE.miss, "No"],
    ]
      .map(
        ([c, label]) => `<td style="padding:0 9px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td><div style="width:11px;height:11px;border-radius:3px;background:${c};font-size:0;line-height:0;">&nbsp;</div></td>
          <td style="padding-left:6px;color:${B.mute};font-size:11px;font-weight:600;">${label}</td>
        </tr></table></td>`,
      )
      .join("")}
  </tr>
</table>`;


// Three steps, because "guess the player" is not actually enough to go
// on: the thing that needs explaining is that a WRONG guess is useful,
// which is the whole mechanic and the least obvious part of it.
const HOW = [
  ["1", "Guess any NFL player", "Anyone. First guess is a shot in the dark, and that is fine."],
  ["2", "Every column answers back", "Team, division, position, age, height, number &mdash; all graded against the mystery player."],
  ["3", "Close the net", "Green is exact, gold is close. Eight guesses to get there."],
];

const how = HOW.map(
  ([n, title, body]) => `<tr>
    <td width="30" valign="top" style="padding:0 12px 16px 0;">
      <div style="width:26px;height:26px;border-radius:13px;background:${B.ground};color:${B.green};
           font-size:13px;font-weight:800;text-align:center;line-height:26px;">${n}</div></td>
    <td valign="top" style="padding:0 0 16px;">
      <div style="color:${B.ink};font-size:15px;font-weight:700;line-height:1.35;">${title}</div>
      <div style="margin-top:3px;color:${B.body};font-size:14px;line-height:1.55;">${body}</div>
    </td>
  </tr>`,
).join("");


const WHY = [
  ["🔥", "Keep a streak alive",
   "Show up every day and the flame on your profile counts the run."],
  ["🟩", "Share it without spoiling it",
   "Your result posts as coloured squares only &mdash; no name, no team. Nobody reading it loses their turn."],
  ["🏆", "Settle who is better",
   "Same player for everyone, so the only question left is who needed fewer guesses."],
];

const why = WHY.map(
  ([icon, title, body]) => `<tr>
    <td width="30" valign="top" style="padding:0 12px 16px 0;font-size:18px;line-height:1.2;">${icon}</td>
    <td valign="top" style="padding:0 0 16px;">
      <div style="color:${B.ink};font-size:15px;font-weight:700;line-height:1.35;">${title}</div>
      <div style="margin-top:3px;color:${B.body};font-size:14px;line-height:1.55;">${body}</div>
    </td>
  </tr>`,
).join("");

export function html({ playUrl, unsubUrl, addr, logo }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${B.wash};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">A new daily game: guess the mystery NFL player in eight tries. Same player for everyone.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${B.wash};padding:24px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:${SANS};">

    <!-- Brand band, then the game's own name set the way the site sets
         it. Bungee will not load in Gmail or Outlook, so the stack falls
         to Arial Black at 900 - heavy and wide either way. -->
    <tr><td style="background:${B.ground};padding:22px 30px 30px;">
      <img src="${logo}" width="180" alt="Sideline Brew" style="display:block;border:0;width:180px;height:auto;">
      <div style="margin:26px 0 0;color:${B.green};font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;">Just launched</div>
      <div style="margin:8px 0 0;color:#ffffff;font-family:${DISPLAY};font-weight:900;font-size:44px;line-height:1;letter-spacing:-.01em;">NAMEPLATE</div>
      <p style="margin:14px 0 0;color:#c3cfe2;font-size:16px;line-height:1.55;">
        A new daily game on Sideline Brew, live as of today. One mystery NFL
        player and eight guesses.
      </p>
    </td></tr>
    <tr><td style="height:4px;background:${B.green};font-size:0;line-height:0;">&nbsp;</td></tr>

    <tr><td style="padding:30px 30px 6px;">
      <div style="color:${B.deep};font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;">How it works</div>
      <p style="margin:12px 0 0;color:${B.ink};font-size:16px;line-height:1.55;font-weight:600;">
        If you have played Wordle, you already know the shape of it &mdash; guess,
        find out how close you were, guess again. This one is NFL players.
      </p>
    </td></tr>
    <tr><td style="padding:16px 30px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${how}</table>
    </td></tr>

    <!-- The board, as the worked example. Every guess grades each column
         and the colours are the whole explanation - which is why this is
         here instead of another paragraph describing it. -->
    <tr><td style="padding:8px 20px 0;" align="center">
      <div style="margin:0 0 14px;color:${B.mute};font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">Three guesses in</div>
      ${board}
    </td></tr>
    <tr><td style="padding:14px 20px 0;" align="center">${key}</td></tr>
    <tr><td style="padding:28px 30px 0;">
      <div style="height:1px;background:${B.hair};font-size:0;line-height:0;">&nbsp;</div>
    </td></tr>
    <tr><td style="padding:24px 30px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${why}</table>
    </td></tr>

    <tr><td align="center" style="padding:26px 30px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${B.green};border-radius:10px;">
        <a href="${playUrl}" style="display:inline-block;padding:16px 40px;color:#06210f;font-size:16px;font-weight:800;text-decoration:none;letter-spacing:.02em;">Play today&rsquo;s game</a>
      </td></tr></table>
    </td></tr>
    <tr><td style="padding:12px 30px 32px;">
      <p style="margin:0;color:${B.mute};font-size:13px;line-height:1.6;text-align:center;">
        Free, no app, about a minute a day. A new player every night at midnight ET.
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
    "NAMEPLATE - just launched",
    "",
    "A new daily game on Sideline Brew, live as of today. One mystery NFL",
    "player and eight guesses.",
    "",
    "HOW IT WORKS",
    "",
    "If you have played Wordle, you already know the shape of it - guess,",
    "find out how close you were, guess again. This one is NFL players.",
    "",
    "1. Guess any NFL player. Anyone. The first guess is a shot in the",
    "   dark, and that is fine.",
    "2. Every column answers back - team, division, position, age, height",
    "   and number, all graded against the mystery player.",
    "3. Green is exact, gold is close. Eight guesses to close the net.",
    "",
    "WHY IT IS WORTH COMING BACK",
    "",
    "- Keep a streak alive. Show up every day and the flame on your",
    "  profile counts the run.",
    "- Share it without spoiling it. Your result posts as coloured squares",
    "  only - no name, no team - so nobody reading it loses their turn.",
    "- Settle who is better. Same player for everyone, so the only",
    "  question left is who needed fewer guesses.",
    "",
    `Play today's game: ${playUrl}`,
    "",
    "Free, no app, about a minute a day. A new player every night at",
    "midnight ET.",
    "",
    `Unsubscribe: ${unsubUrl}`,
    "",
    addr,
  ].join("\n");
}

// Dallas's call, made with the trademark point already on the table.
// "Wordle" is the New York Times' mark and this uses it as a label
// rather than a comparison, which is the more exposed of the two - worth
// knowing, and his decision to make.
//
// Short on purpose beyond that: 21 characters survives every mobile
// inbox that truncates, and the preheader carries the explanation.
export const SUBJECT = "New Game: NFL Wordle!";
