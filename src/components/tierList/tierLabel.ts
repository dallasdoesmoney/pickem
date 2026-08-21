// How a tier's name is set, shared by the board's rows and by the
// pyramid so the two can't drift apart.
//
// Not the display face. Bungee is a poster face - it is all caps, very
// heavy, and at the size a rail wants it turns a tier name into a slab
// you read letter by letter. The rail is a label, not a headline, so it
// takes the body face at a medium weight and a little tracking. Caps are
// kept, because Bungee only ever had caps and the board's look is built
// on that; the difference is the weight.
export const TIER_LABEL_FONT = {
  fontFamily: "var(--font-sans)",
  fontWeight: 600,
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

// A letter is not a name. "S" and "CHAMPIONSHIP" are different KINDS of
// label, so they get different sizes and that reads as deliberate; two
// names at two sizes reads as a bug.
const isLetter = (label: string) => {
  const t = label.trim();
  return t.length > 0 && t.length <= 2 && !/\s/.test(t);
};

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
