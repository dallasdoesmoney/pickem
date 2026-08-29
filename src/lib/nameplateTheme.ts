// The sticker language, in one place - moved down the scale. Same four
// rules as the cream board it replaces (solid ground, hard outline, hard
// offset shadow, no transparency), with one thing kept deliberately: the
// CARD IS LIGHTER THAN THE PAGE. That is what makes an offset shadow read
// as depth on a dark ground instead of as a smudge, and it is the whole
// trick behind this palette.
//
// The chips stay light, so black type on them survives the change - the
// board is dark, the stickers on it are not.
//
// A MODULE, not a block at the top of DailyPuzzle, because the stats now
// draw on the same palette from two other screens. Six hex values copied
// into three files is six values that will disagree the first time one
// of them is nudged.
export const CARD = "#141d31";
export const FIELD = "#0e1626";
export const RULE = "#2b3a56";
export const TEXT = "#eef3fb";
export const MUTED = "#7d8ca6";
export const ALARM = "#ff6f61";
// Ink is the colour of type ON A CHIP, and only that. Everything written
// on the card itself uses TEXT.
export const INK = "#0a1020";
// The accent, and the one colour that means "right" everywhere in this
// game - the exact-match chip, the live mode in the toggle, today's
// strip. Anything wearing it is making that claim.
export const GREEN = "#3ecb78";
// "Close" on a chip. Unlimited's strip borrows it, which is a meaning
// being spent - see the strip in DailyPuzzle.
export const GOLD = "#ffce3a";
export const EDGE = `2px solid #0a1120`;
// The card sits on the page, so it gets an ambient shadow; the chips sit
// on the card, so they keep the hard offset. Two different jobs that were
// one constant when everything was cream.
export const CARD_EDGE = `1px solid ${RULE}`;
export const DROP = `0 24px 60px -22px #000000`;
