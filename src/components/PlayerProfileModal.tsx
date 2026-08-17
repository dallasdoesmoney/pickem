"use client";

import { useState } from "react";
import { LeaderboardRow } from "@/lib/supabase/leaderboard";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { FriendButton } from "@/components/FriendButton";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { LevelListModal } from "@/components/LevelListModal";
import { StatTile, StatDetailRow } from "@/components/StatTile";
import { TeamsPredictedRow } from "@/components/TeamsPredictedRow";

// The whole profile in one scrollable popup - no more "view full profile
// page" hop to a separate route. The standalone /leaderboard/[username]
// page still exists for direct/shareable links (notifications, sharing a
// profile URL outside the app), but browsing from the leaderboard never
// needs to leave it.
export function PlayerProfileModal({
  row,
  myId,
  onClose,
  onFriendshipChange,
}: {
  row: LeaderboardRow | null;
  myId?: string;
  onClose: () => void;
  onFriendshipChange?: () => void;
}) {
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const stats = usePlayerStats(row?.user_id);

  if (!row) return null;
  const label = row.display_name || row.username;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
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

        <div className="overflow-y-auto px-6 pb-6 pt-8 flex flex-col items-center">
          {row.avatar_url ? (
            <img src={row.avatar_url} alt="" className="h-24 w-24 rounded-full object-cover border-2 border-white/20" />
          ) : (
            <span className="h-24 w-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-3xl">
              {label.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex items-center gap-2 mt-4">
            <h2 className="text-2xl text-center" style={{ fontFamily: "var(--font-display)" }}>
              {label}
            </h2>
            <button type="button" onClick={() => setLevelModalOpen(true)} aria-label="View all levels" className="active:scale-95 transition-transform">
              <LevelBadge totalPoints={row.total_points} size="lg" />
            </button>
          </div>
          <p className="text-white/45 text-sm mt-1">@{row.username}</p>
          <PlayerBadges userId={row.user_id} />

          <div className="w-full mt-6 grid grid-cols-3 gap-2">
            <StatTile icon="🔗" value={stats ? String(stats.referralCount) : "–"} label="REFERRALS" accentColor="#c084fc" />
            <StatTile icon="🔥" value="–" label="STREAK SOON" accentColor="rgba(255,255,255,0.35)" />
            <StatTile icon="🏆" value={`${row.correct}-${row.graded - row.correct}`} label="SEASON" accentColor="#4ade80" />
          </div>

          <div className="w-full mt-5">
            <div className="text-[10px] text-white/45 tracking-[0.15em] mb-2">MORE STATS</div>
            <div className="flex flex-col gap-1.5">
              <StatDetailRow icon="👥" label="Friends" value={stats ? String(stats.friendCount) : "–"} />
              <TeamsPredictedRow completedCount={stats?.completedTeamCount} completedAbbrs={stats?.completedTeamAbbrs} />
              <StatDetailRow icon="🔒" label="Lock bonuses hit" value={stats ? String(stats.lockBonusCount) : "–"} />
              <StatDetailRow icon="📅" label="Weeks completed" value={stats ? String(stats.completedWeekCount) : "–"} />
            </div>
          </div>

          {myId && myId !== row.user_id && (
            <div className="mt-6 w-full flex justify-center">
              <FriendButton myId={myId} otherId={row.user_id} onChange={onFriendshipChange} />
            </div>
          )}
        </div>
      </div>

      <LevelListModal open={levelModalOpen} totalPoints={row.total_points} onClose={() => setLevelModalOpen(false)} />
    </div>
  );
}
