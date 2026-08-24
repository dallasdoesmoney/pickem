// A live daily check-in streak: the flame itself, with the day count
// sitting on it. No chip, no border - the emoji is the badge.
//
// Renders nothing at 0, which is also what the leaderboard view reports
// for a streak that has already been broken - so this never has to decide
// what "still going" means, and a lapsed player simply has no badge
// rather than a stale one. See supabase/migrations/0045_leaderboard_streak.sql.
//
// Deliberately silent on day one. A "1" next to everybody who opened the
// app today is not a streak, it is attendance, and it would put a flame
// beside every name on the board on any given day - at which point the
// badge stops distinguishing anyone. It starts at 2, where coming back is
// the thing being shown.
const MIN_VISIBLE = 2;

const SIZES = {
  xs: { emoji: "text-lg", num: "text-[9px]", numWide: "text-[7.5px]", pad: "pb-[1px]" },
  sm: { emoji: "text-2xl", num: "text-[11px]", numWide: "text-[9px]", pad: "pb-[2px]" },
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
        className={`absolute inset-0 flex items-end justify-center ${s.pad} ${streak >= 100 ? s.numWide : s.num} font-bold text-white tabular-nums whitespace-nowrap`}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,.95), 0 0 3px rgba(0,0,0,1)" }}
      >
        {streak}
      </span>
    </span>
  );
}
