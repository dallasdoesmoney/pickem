"use client";

import { LeaderboardRow } from "@/lib/supabase/leaderboard";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { ProfileCard } from "@/components/ProfileCard";
import { rankWashStyle } from "@/components/RankPanel";
import { getLevelInfo } from "@/lib/levels";

// The whole profile in one scrollable popup - no more "view full profile
// page" hop to a separate route. The standalone /leaderboard/[username]
// page still exists for direct/shareable links (notifications, sharing a
// profile URL outside the app), but browsing from the leaderboard never
// needs to leave it.
//
// Only the surface lives here - the popup shell, the scrim and the close
// button. Everything inside is ProfileCard, shared with that standalone
// page so the two can't drift.
export function PlayerProfileModal({
  row,
  myId,
  onClose,
  onFollowChange,
}: {
  row: LeaderboardRow | null;
  myId?: string;
  onClose: () => void;
  onFollowChange?: () => void;
}) {
  const stats = usePlayerStats(row?.user_id);

  if (!row) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
        {/* Same rank wash the account page and the public profile page
            carry. It sits on the panel rather than inside the scrolling
            body, so it stays pinned behind the avatar instead of sliding
            away with the stats - this popup is where most people see
            someone else's profile, so it is the one that matters most. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0"
          style={rankWashStyle(getLevelInfo(row.total_points).rankColor)}
        />
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full border border-white/15 bg-black/40 text-white/60 hover:text-white flex items-center justify-center backdrop-blur-sm"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>

        <div className="relative overflow-y-auto px-6 pb-6 pt-8">
          <ProfileCard row={row} stats={stats} myId={myId} onFollowChange={onFollowChange} />
        </div>
      </div>
    </div>
  );
}
