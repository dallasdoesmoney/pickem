// How a tier's name is set, shared by the board's rows and by the
// pyramid so the two can't drift apart.
//
// Not the display face. Bungee is a poster face - it is all caps, very
// heavy, and at the size a rail wants it turns a tier name into a slab
// you read letter by letter. The rail is a label, not a headline, so it
// takes the body face at a medium weight and a little tracking. Caps are
// kept, because Bungee only ever had caps and the board's look is built
// on that; the difference is the weight.
// 500, not 600. The rail is a small block of solid colour with dark type
// on it, and at that contrast a semibold reads heavier than it measures -
// but the real reason is width: 600 is about 2% wider per character than
// 500, and every one of those percent comes out of how many letters of a
// name fit the rail on one line.
export const TIER_LABEL_FONT = {
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  letterSpacing: "0.03em",
  color: "#0c1830",
} as const;

export const TIER_LABEL_LEADING = 1.18;

// TWO FLAT SIZES. Not solved, not stepped: a letter is 20 and a name is
// 15, on every board, at every width.
//
// What that trades away is worth stating plainly. A name wraps between
// words and never inside one, so its longest single WORD has to fit the
// rail on one line - and at 15px a 136px rail holds eleven characters, a
// phone's 104px rail eight. A longer word than that is cut off by the
// rail rather than shrunk to fit. That is the deal a fixed size makes:
// every board reads at the same two sizes, and the rare very long word
// is visibly too long instead of quietly resized.
const LETTER_SIZE = 20;
const NAME_SIZE = 15;

// THE BOARD'S RAIL IS A SQUARE THAT MOVES, so neither of the two numbers
// above works on it. What follows replaces them for the board only; the
// pyramid still uses its own pair further down.
//
// A LETTER is set as a fraction of the rail. It is one glyph in a
// square, so nothing has to be solved - it just has to stay the same
// share of the block at 54px as at 96.
const LETTER_RATIO = 0.17;
const LETTER_CAP = 17;
const LETTER_MIN = 11;

// A NAME IS SOLVED SO ITS LONGEST WORD FITS ON ONE LINE.
//
// A rail wraps between words and never inside one, so the binding
// constraint is the longest single word: if "FAVORITES" does not fit,
// nothing about the label is right. Breaking the word instead put
// "CONTEND / ER" on the board, which is worse than small type; clipping
// it is worse still, because the label then names nothing.
//
// So the size comes out of the arithmetic rather than a table. Measured
// in the browser with the real face: Geist at 500, uppercase, plus the
// rail's 0.03em of tracking, the widest words come to 0.70em a
// character. 0.72 is what that is solved against, so a word of unusually
// wide glyphs still lands inside the rail rather than one pixel over it.
const EM_PER_CHAR = 0.72;
// The rail's own 6px of padding a side, plus 2 of slack so a solved size
// is never flush against the edge.
const RAIL_INSET = 14;
const NAME_CAP = 13;
// A floor, because there is a size below which the answer stops being
// type at all. It only binds on a 320px phone carrying a nine-letter
// name - the one board this cannot satisfy, where the word is longer
// than the square can hold at any readable size.
const NAME_MIN = 8;

export const tierRailLetterSize = (railWidth: number): number =>
  Math.max(LETTER_MIN, Math.min(LETTER_CAP, Math.round(railWidth * LETTER_RATIO)));

// Solved ONCE for the whole board, from the longest word on it, and used
// by every named tier. Sized individually, a board of "ELITE / CONTENDER
// / MID" would set three rails at three sizes, which reads as three
// unrelated labels rather than one scale - and the tier whose name
// happened to be short would look like the important one.
export const tierRailNameSize = (
  labels: readonly string[],
  railWidth: number,
): { size: number; mustBreak: boolean } => {
  const longest = labels
    .filter((l) => !isLetterLabel(l))
    .flatMap((l) => l.trim().split(/\s+/))
    .reduce((n, word) => Math.max(n, word.length), 0);
  if (longest === 0) return { size: NAME_CAP, mustBreak: false };
  const fits = Math.floor((railWidth - RAIL_INSET) / (longest * EM_PER_CHAR));
  // mustBreak is the honest admission that shrinking ran out of room:
  // the word does not fit even at the floor, so something has to give.
  // Breaking it is the least bad of the three - clipping loses the name
  // outright, and going below the floor is type nobody can read - and it
  // is confined to the case that earned it. "CHAMPIONSHIP" on a phone
  // does this; nothing shorter does.
  return { size: Math.max(NAME_MIN, Math.min(NAME_CAP, fits)), mustBreak: fits < NAME_MIN };
};

// A letter is not a name. "S" and "CHAMPIONSHIP" are different KINDS of
// label, so they get different sizes and that reads as deliberate; two
// names at two sizes reads as a bug.
// Exported because the rail's WIDTH now asks the same question its type
// size does. A board of letters is squared off; one carrying names keeps
// the wider rail those names need. Two answers from one definition, so
// they cannot drift into a board that is sized for a letter and set for a
// name.
export const isLetterLabel = (label: string) => {
  const t = label.trim();
  return t.length > 0 && t.length <= 2 && !/\s/.test(t);
};

const isLetter = isLetterLabel;

// The pyramid's band is narrower than the board's rail - 111px against
// 124 on a desktop, because it is a fraction of the triangle rather than
// a fixed width - so the board's sizes clip in it. These are the two
// that give the band the SAME capacity the rail has at 15px: eleven
// characters of a single word - measured, a twelve-letter name needs
// 101px of the 107 the band has at 1024, and 111 at 1280. Anything the
// tier list can show on a laptop or bigger, the pyramid can show too.
const PYRAMID_LETTER_SIZE = 16;
const PYRAMID_NAME_SIZE = 12;

export const TIER_LABEL_SIZES = { letter: LETTER_SIZE, word: NAME_SIZE } as const;

export const pickTierLabelSize = (label: string, pyramid = false): number => {
  if (isLetter(label)) return pyramid ? PYRAMID_LETTER_SIZE : LETTER_SIZE;
  return pyramid ? PYRAMID_NAME_SIZE : NAME_SIZE;
};
