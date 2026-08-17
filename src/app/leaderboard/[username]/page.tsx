"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { FriendButton } from "@/components/FriendButton";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { LevelListModal } from "@/components/LevelListModal";
import { StatTile, StatDetailRow } from "@/components/StatTile";
import { TeamsPredictedRow } from "@/components/TeamsPredictedRow";

// A client page (not the server-component-plus-notFound() pattern used by
// /predictor/[team], which validates against a fixed, known team list) -
// usernames are arbitrary and change over time, so "does this one exist"
// has to be a real query, not a static param check. Kept around as a
// direct/shareable URL (notifications, sharing a profile link outside the
// app) - browsing from the leaderboard itself uses PlayerProfileModal's
// popup instead, same content, no page navigation.
export default function PlayerPage() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();
  const [row, setRow] = useState<LeaderboardRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [levelModalOpen, setLevelModalOpen] = useState(false);
  const stats = usePlayerStats(row?.user_id);

  useEffect(() => {
    fetchLeaderboardEntry(params.username)
      .then(setRow)
      .catch((err) => setError(errorMessage(err)));
  }, [params.username]);

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <Link href="/leaderboard" className="text-xs text-white/40 hover:text-white/70 transition-colors">
        &larr; Back to leaderboard
      </Link>

      {error && <p className="text-sm text-red-400 text-center mt-10">{error}</p>}

      {row === undefined && !error ? (
        <div className="flex justify-center py-16">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : row === null ? (
        <div className="text-center py-16 text-white/50">
          <div className="text-4xl mb-3">🏈</div>
          <p className="text-sm">No player found for &ldquo;{params.username}&rdquo;.</p>
        </div>
      ) : row ? (
        <div className="flex flex-col items-center mt-10">
          {row.avatar_url ? (
            <img src={row.avatar_url} alt="" className="h-28 w-28 rounded-full object-cover border-2 border-white/20" />
          ) : (
            <span className="h-28 w-28 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-4xl">
              {(row.display_name || row.username).charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex items-center gap-2 mt-4">
            <h1 className="text-3xl text-center" style={{ fontFamily: "var(--font-display)" }}>
              {row.display_name || row.username}
            </h1>
            <button type="button" onClick={() => setLevelModalOpen(true)} aria-label="View all levels" className="active:scale-95 transition-transform">
              <LevelBadge totalPoints={row.total_points} size="lg" />
            </button>
          </div>
          <p className="text-white/45 text-sm mt-1">@{row.username}</p>
          <PlayerBadges userId={row.user_id} />

          <div className="w-full mt-8 grid grid-cols-3 gap-2.5">
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

          {user && user.id !== row.user_id && (
            <div className="mt-6">
              <FriendButton myId={user.id} otherId={row.user_id} />
            </div>
          )}
        </div>
      ) : null}

      {row && <LevelListModal open={levelModalOpen} totalPoints={row.total_points} onClose={() => setLevelModalOpen(false)} />}
    </main>
  );
}
