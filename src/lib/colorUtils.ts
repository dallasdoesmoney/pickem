// Mixes a hex color toward white by `amount` (0-1) - used to derive a
// badge's gradient light-stop from its single catalog color, so every
// badge gets the same "light-to-base, 135deg" treatment as LevelBadge's
// visual family without hand-picking two colors per badge.
export function lightenHex(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `#${[mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

export function badgeGradient(color: string): string {
  return `linear-gradient(135deg, ${lightenHex(color, 0.35)}, ${color})`;
}

// A team's colour as a background you can actually put text on, plus the
// ink to use. Returns both because the two are one decision.
//
// Picking black or white by luminance is the obvious version and it is not
// enough. Six of the thirty-two - Panthers, Bengals, Broncos, Chargers,
// Dolphins, Titans - are mid-tone cyans and oranges that clear 4.5:1
// against neither, landing between 3.26 and 4.28. Measured, not assumed.
//
// So when neither ink works the colour is shifted until one does, taking
// whichever direction moves it least: a deeper Bengals orange still reads
// as Bengals where a pastel one does not. Those six come out a shade off
// their exact brand colour, which is the price of a readable tile.
const INK_DARK = "#16181c";
const INK_LIGHT = "#ffffff";
const MIN_CONTRAST = 4.5;

function channels(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const x = relativeLuminance(a);
  const y = relativeLuminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function mixHex(hex: string, target: string, amount: number): string {
  const from = channels(hex);
  const to = channels(target);
  return `#${from
    .map((c, i) => Math.round(c + (to[i] - c) * amount).toString(16).padStart(2, "0"))
    .join("")}`;
}

export function teamTile(hex: string): { bg: string; ink: string } {
  const best = contrastRatio(hex, INK_DARK) >= contrastRatio(hex, INK_LIGHT) ? INK_DARK : INK_LIGHT;
  if (contrastRatio(hex, best) >= MIN_CONTRAST) return { bg: hex, ink: best };

  for (let step = 0.05; step <= 1; step += 0.05) {
    const lighter = mixHex(hex, INK_LIGHT, step);
    if (contrastRatio(lighter, INK_DARK) >= MIN_CONTRAST) return { bg: lighter, ink: INK_DARK };
    const darker = mixHex(hex, INK_DARK, step);
    if (contrastRatio(darker, INK_LIGHT) >= MIN_CONTRAST) return { bg: darker, ink: INK_LIGHT };
  }
  return { bg: INK_DARK, ink: INK_LIGHT };
}
