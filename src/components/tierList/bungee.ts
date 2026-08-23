// How wide a string is in Bungee, in em.
//
// Bungee is an all-caps display face and it is NOT monospaced: I is 0.605
// em and M is 0.849, a 40% spread. Anywhere text has to be shrunk to fit
// a box, a single per-character average is therefore either too small
// (every name renders smaller than it needs to) or too large (the wide
// names get cut off). BUNGEE_ADVANCE, 0.82, is the near-widest glyph and
// so lands firmly on the first side of that: safe, and several pixels
// smaller than the space actually allows.
//
// This is the table instead. Measured off the loaded face with a canvas
// at 1000px and rounded to four places; summing the glyphs reproduces
// measureText on whole words to within 0.4%, and errs high, because
// kerning only ever pulls a pair tighter than its two advances. Erring
// high is the direction that cannot clip.
const WIDTHS: Record<string, number> = {
  A: 0.73, B: 0.725, C: 0.628, D: 0.746, E: 0.654, F: 0.618, G: 0.708,
  H: 0.759, I: 0.605, J: 0.688, K: 0.746, L: 0.695, M: 0.849, N: 0.753,
  O: 0.737, P: 0.682, Q: 0.737, R: 0.743, S: 0.65, T: 0.656, U: 0.746,
  V: 0.73, W: 0.831, X: 0.737, Y: 0.705, Z: 0.66,
  "0": 0.727, "1": 0.601, "2": 0.639, "3": 0.637, "4": 0.709, "5": 0.647,
  "6": 0.693, "7": 0.627, "8": 0.711, "9": 0.693,
  " ": 0.225, "'": 0.356, "-": 0.42, ".": 0.384, "&": 0.766, "/": 0.347,
};

// Anything not in the table - an accent, a comma, an em dash - takes the
// widest glyph there is. A character we have not measured must not be the
// one that overflows.
const UNKNOWN = 0.849;

export function bungeeEm(text: string): number {
  let em = 0;
  for (const ch of text.toUpperCase()) em += WIDTHS[ch] ?? UNKNOWN;
  return em;
}

// The longest run that cannot be broken. Text wraps at spaces, so what
// decides whether a line of type fits a box is never the whole string -
// it is the widest single word in it. A three-word title can take a
// third line; QUARTERBACKS cannot take a second.
export function widestWordEm(text: string): number {
  let widest = 0;
  for (const word of text.trim().split(/\s+/)) {
    widest = Math.max(widest, bungeeEm(word));
  }
  return Math.max(widest, 0.001);
}
