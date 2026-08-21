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
// the letter-spacing. Estimated rather than measured because this is
// called during render, and a canvas measurement would give the server
// and the browser different answers.
const ADVANCE = 0.73;

// Small, but not so small that a name is decoration. Below this the rail
// would be showing that a tier is named rather than what it is named.
const FLOOR = 8;

// Type steps down in bands rather than scaling continuously, so tiers of
// similar name length stay visually consistent with each other.
//
// A NAME WRAPS BETWEEN WORDS AND NEVER INSIDE ONE. A word split across
// two lines is not a shorter word, it is two wrong ones, and on a rail
// this narrow it is what "CHAMPI / ONSHIP" looked like. So the size is
// capped by what the LONGEST WORD can measure at - wrapping cannot
// rescue a single word that is too wide, only a smaller size can - and
// then again by the height the rail can give the lines it needs.
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

  const longest = words.reduce((m, w) => Math.max(m, w.length), 1);
  const capByWord = Math.floor(width / (ADVANCE * longest));

  for (let size = Math.min(band, capByWord); size > FLOOR; size--) {
    // Greedy wrap at spaces, exactly as the browser will do it.
    let lines = 1;
    let used = 0;
    for (const word of words) {
      const w = word.length * ADVANCE * size;
      const withSpace = used ? used + ADVANCE * size + w : w;
      if (used && withSpace > width) {
        lines += 1;
        used = w;
      } else {
        used = withSpace;
      }
    }
    if (lines <= maxLines && lines * size * TIER_LABEL_LEADING <= maxHeight) return size;
  }
  return FLOOR;
}
