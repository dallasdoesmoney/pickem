// Plain visual circle - no click behavior of its own, so it can drop
// into contexts that already have their own click target (a leaderboard
// row is itself a button that opens the profile popup, where the real
// tap-to-explain version in PlayerBadges lives). className controls size.
export function CreatorBadgeIcon({ className = "h-8 w-8 text-base" }: { className?: string }) {
  return (
    <span title="Creator" className={`rounded-full flex items-center justify-center shrink-0 ${className}`} style={{ background: "#ef4444" }}>
      🎥
    </span>
  );
}
