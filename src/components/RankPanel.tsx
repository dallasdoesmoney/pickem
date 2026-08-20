"use client";

// The rank-washed surface. Started as a one-off on the account page's
// identity block and is now the standard treatment for every profile
// panel on both the account page and the public profile, so the two read
// as the same object rather than as two different designs of the same
// thing.
//
// The wash is a radial gradient in the player's own rank colour, poured
// from the top edge. Tying it to rank rather than a fixed accent means a
// profile is recognisably yours at a glance and visibly changes as you
// climb - the colour IS the progress.

export type RankPanelTone = "hero" | "quiet";

// hero: the identity block, one per page. The colour is the point.
// quiet: everything under it. Same hue, roughly half the strength and a
// shallower pour, so the panels below read as a family without competing
// with the one at the top. Without the split every panel shouts and the
// hierarchy disappears - the effect works because it is not uniform.
// Tuned by measuring the actual pixel lift at the top of each panel
// against its own base colour rather than by eye, then checked against
// the rendered popup. Two earlier passes were both too timid: a fifth of
// hero strength measured +1 and was simply invisible, and the first
// "prominent" pass was still hard to distinguish from no wash at all.
// These values pour further down the panel as well as sitting stronger
// at the top - height does as much work as alpha here, because a bright
// band that dies in 9rem reads as a rim light rather than a wash.
//
// The ceiling is legibility: past roughly alpha 73 the tint starts
// competing with the white name sitting on top of it.
const TONE = {
  hero: { alpha: "59", height: "15rem", spread: "140% 100%", fade: "76%" },
  // Still about half of hero, so the panels below read as the same family
  // without competing with the identity block above them.
  quiet: { alpha: "2d", height: "12rem", spread: "132% 100%", fade: "78%" },
} as const;

// The wash on its own, for surfaces that already have their own layout
// and can't be wrapped - the profile popup, whose panel has to stay a
// flex column with a pinned close button and a scrolling body. Same
// numbers, so the popup and the two pages can't drift apart.
export function rankWashStyle(rankColor: string | null, tone: RankPanelTone = "hero"): React.CSSProperties {
  const { alpha, height, spread, fade } = TONE[tone];
  const tint = rankColor ? `${rankColor}${alpha}` : "rgba(255,255,255,0.08)";
  return { height, background: `radial-gradient(${spread} at 50% 0%, ${tint}, transparent ${fade})` };
}

export function RankPanel({
  rankColor,
  tone = "quiet",
  className = "",
  innerClassName = "",
  children,
}: {
  // Null when the player has no rank yet (under the first level
  // threshold): the panel still gets a wash so the shape is consistent,
  // just a colourless one.
  rankColor: string | null;
  tone?: RankPanelTone;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0" style={rankWashStyle(rankColor, tone)} />
      <div className={`relative ${innerClassName}`}>{children}</div>
    </div>
  );
}
