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

// A pessimistic stand-in for the face's advance width in caps, tracking
// included. Measured across the names people actually type, the widest
// ("SUPERBOWL") runs 0.70em and the rest sit below it; the extra covers
// the letter-spacing above.
const ADVANCE = 0.73;

// How many characters actually land on one line is a worse number than
// the average: a line that happens to catch the wide caps - C, H, M, W -
// holds fewer of them, and it only takes one such line to push the block
// onto an extra row.
const WIDEST = 0.85;

// Type steps down in bands rather than scaling continuously, so tiers of
// similar name length stay visually consistent with each other.
//
// The band alone isn't enough: the rail is much narrower on a phone than
// on a desktop, and a band picked for a 136px rail is far too big for an
// 86px one. What decides it is HEIGHT, not width - the label wraps and
// will break a word if it has to, so a long name does not need to fit
// across on one line, it needs to fit in the rows the rail can give it.
// Capping on the longest word instead is what dropped "CHAMPIONSHIP" to
// 9px on a phone inside a rail with room for three comfortable lines.
export function tierLabelSize(
  label: string,
  innerWidth: number,
  maxHeight: number,
  maxLines = 3,
): number {
  const words = label.trim().split(/\s+/).filter(Boolean);
  const n = Math.max(1, label.trim().length);
  const band = n <= 2 ? 22 : n <= 5 ? 16 : n <= 9 ? 14 : n <= 14 ? 13 : n <= 22 ? 12 : 11;
  const width = Math.max(1, innerWidth);
  for (let size = band; size > 9; size--) {
    // Word by word, because wrapping does not pack: a word that needs a
    // second line leaves the tail of the first one empty, and estimating
    // off the whole string was what let a four-line name through as a
    // three-line one.
    const perLine = Math.max(1, Math.floor(width / (WIDEST * size)));
    const lines =
      n * ADVANCE * size <= width
        ? 1
        : words.reduce((a, word) => a + Math.ceil(word.length / perLine), 0);
    if (lines <= maxLines && lines * size * TIER_LABEL_LEADING <= maxHeight) return size;
  }
  return 9;
}
