// A live daily check-in streak, as a flame and a number.
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

export function StreakBadge({ streak, size = "sm" }: { streak: number; size?: "xs" | "sm" }) {
  if (!streak || streak < MIN_VISIBLE) return null;

  const text = size === "xs" ? "text-[10px]" : "text-[11px]";
  const pad = size === "xs" ? "px-1 py-0" : "px-1.5 py-0.5";

  return (
    <span
      title={`${streak}-day check-in streak`}
      aria-label={`${streak} day check-in streak`}
      className={`shrink-0 inline-flex items-center gap-0.5 rounded-full border border-orange-400/30 bg-orange-400/10 ${pad} ${text} text-orange-300 tabular-nums whitespace-nowrap`}
    >
      <span aria-hidden>🔥</span>
      {streak}
    </span>
  );
}
