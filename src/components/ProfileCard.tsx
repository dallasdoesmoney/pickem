"use client";

import { useState } from "react";
import { LeaderboardRow } from "@/lib/supabase/leaderboard";
import { PlayerStats } from "@/hooks/usePlayerStats";
import { getLevelInfo } from "@/lib/levels";
import { FollowButton } from "@/components/FollowButton";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { CreatorLinks } from "@/components/CreatorLinks";
import { LevelListModal } from "@/components/LevelListModal";
import { ProfileSocialLine } from "@/components/ProfileSocialLine";
import { StatTile, StatDetailRow } from "@/components/StatTile";
import { TeamsPredictedRow } from "@/components/TeamsPredictedRow";

// Everything inside a profile, minus the surface it's sitting on. Both
// callers (the popup on the leaderboard and the standalone
// /leaderboard/[username] page) used to hold their own copy of this
// column and had already drifted - different avatar sizes, different
// grid gaps - so it lives here now and they pass a variant instead.
// usePlayerStats has the same note for the same reason.
//
// Layout, top to bottom: identity (avatar, name, handle, followers and
// friends, badges, links), the three KPI tiles, then the remaining
// stats. Teams predicted keeps a full-width row because "32 / 32" needs
// the room and because tapping it expands the team mosaic in place; the
// last two pair off underneath, which is what keeps the whole card
// inside the popup's max-h-[85vh] without scrolling.
export function ProfileCard({
  row,
  stats,
  myId,
  variant = "modal",
  onFollowChange,
}: {
  row: LeaderboardRow;
  stats: PlayerStats | null;
  myId?: string;
  variant?: "modal" | "page";
  onFollowChange?: () => void;
}) {
  const [levelModalOpen, setLevelModalOpen] = useState(false);

  const label = row.display_name || row.username;
  const rankColor = getLevelInfo(row.total_points).rankColor;
  const avatarSize = variant === "page" ? "h-28 w-28" : "h-24 w-24";
  const avatarFallbackText = variant === "page" ? "text-4xl" : "text-3xl";
  const nameSize = variant === "page" ? "text-3xl" : "text-2xl";

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative">
        {row.avatar_url ? (
          <img
            src={row.avatar_url}
            alt=""
            className={`${avatarSize} rounded-full object-cover`}
            style={{ boxShadow: `0 0 0 2px ${rankColor}, 0 0 10px -2px ${rankColor}` }}
          />
        ) : (
          <span
            className={`${avatarSize} ${avatarFallbackText} rounded-full bg-white/10 flex items-center justify-center`}
            style={{ boxShadow: `0 0 0 2px ${rankColor}, 0 0 10px -2px ${rankColor}` }}
          >
            {label.charAt(0).toUpperCase()}
          </span>
        )}
        <button
          type="button"
          onClick={() => setLevelModalOpen(true)}
          aria-label="View all levels"
          className="absolute left-1/2 -bottom-2 w-max -translate-x-1/2 active:scale-95 transition-transform"
        >
          <LevelBadge totalPoints={row.total_points} size="sm" />
        </button>
      </div>

      <h2 className={`${nameSize} text-center mt-4`} style={{ fontFamily: "var(--font-display)" }}>
        {label}
      </h2>
      <p className="text-white/45 text-sm mt-1">@{row.username}</p>
      <ProfileSocialLine userId={row.user_id} followerCount={stats?.followerCount} friendCount={stats?.friendCount} />
      <PlayerBadges userId={row.user_id} />
      <CreatorLinks userId={row.user_id} />

      <div className="w-full mt-6 grid grid-cols-3 gap-2">
        <StatTile icon="🔗" value={stats ? String(stats.referralCount) : "–"} label="REFERRALS" accentColor="#c084fc" />
        <StatTile icon="🔥" value="–" label="STREAK SOON" accentColor="rgba(255,255,255,0.35)" />
        <StatTile icon="🏆" value={`${row.correct}-${row.graded - row.correct}`} label="SEASON" accentColor="#4ade80" />
      </div>

      <div className="w-full mt-2 flex flex-col gap-1.5">
        <TeamsPredictedRow completedCount={stats?.completedTeamCount} completedAbbrs={stats?.completedTeamAbbrs} />
        {/* Short labels because these two share a row - "Lock bonuses
            hit" and "Weeks completed" don't fit half a card. */}
        <div className="grid grid-cols-2 gap-1.5">
          <StatDetailRow icon="🔒" label="Locks" value={stats ? String(stats.lockBonusCount) : "–"} />
          <StatDetailRow icon="📅" label="Weeks" value={stats ? String(stats.completedWeekCount) : "–"} />
        </div>
      </div>

      {/* Always visible, even signed out - clicking it while signed out
          prompts sign-in instead of the button just disappearing, same as
          every other "here's what you could do" affordance. */}
      {(!myId || myId !== row.user_id) && (
        <div className="mt-6 w-full flex justify-center">
          <FollowButton myId={myId} otherId={row.user_id} onChange={onFollowChange} />
        </div>
      )}

      <LevelListModal open={levelModalOpen} totalPoints={row.total_points} onClose={() => setLevelModalOpen(false)} />
    </div>
  );
}
