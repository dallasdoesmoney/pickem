// A live daily check-in streak: the flame itself, with the day count
// sitting on it. No chip, no border - the emoji is the badge.
//
// Renders nothing at 0, which is also what the leaderboard view reports
// for a streak that has already been broken - so this never has to decide
// what "still going" means, and a lapsed player simply has no badge
// rather than a stale one. See supabase/migrations/0045_leaderboard_streak.sql.
//
// Shows from day one. This used to start at 2, on the argument that a "1"
// beside everybody who opened the app today is attendance rather than a
// streak. The call went the other way, and the reason is better: the
// profile page has always shown a 1-day streak, so hiding it on the
// leaderboard made the same account look like it had no streak in one
// place and a streak in another. A badge that disagrees with the profile
// behind it is worse than a badge that is common.
//
// Day one is also the day the flame is worth the most - it is the first
// thing anybody has to lose, and nobody protects a streak they were never
// shown.
const MIN_VISIBLE = 1;

// Sized against what sits beside it rather than against the text: on a
// leaderboard row that is the 26px creator pill, and a flame smaller than
// its neighbour reads as an afterthought. Rendered side by side at 18,
// 22, 26 and 30 - 18 was too small to carry a number at all, and 30
// outweighs the pill and starts running the row.
const SIZES = {
  xs: { emoji: "text-[26px]", num: "text-[12px]", numWide: "text-[9.5px]", pad: "pb-[2px]" },
  sm: { emoji: "text-[32px]", num: "text-[15px]", numWide: "text-[12px]", pad: "pb-[2px]" },
} as const;

export function StreakBadge({ streak, size = "sm" }: { streak: number; size?: keyof typeof SIZES }) {
  if (!streak || streak < MIN_VISIBLE) return null;

  const s = SIZES[size];

  return (
    <span
      title={`${streak}-day check-in streak`}
      aria-label={`${streak} day check-in streak`}
      className="relative inline-flex shrink-0 items-center justify-center leading-none"
    >
      <span aria-hidden className={`${s.emoji} leading-none`}>
        🔥
      </span>
      {/* Pinned low and centred: the flame's widest, calmest area is its
          base, and a number sitting up in the tip reads as floating
          beside it rather than on it. The dark halo is doing real work -
          white on that yellow is otherwise unreadable at 9px. Three
          digits step down a size rather than overhanging the glyph -
          measured, not guessed: at the full size "128" spills past the
          flame's base and stops reading as part of it. */}
      <span
        aria-hidden
        className={`absolute inset-0 flex items-end justify-center ${s.pad} ${streak >= 100 ? s.numWide : s.num} font-extrabold text-white tabular-nums whitespace-nowrap`}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1), 0 0 4px rgba(0,0,0,.9)" }}
      >
        {streak}
      </span>
    </span>
  );
}
