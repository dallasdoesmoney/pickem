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
