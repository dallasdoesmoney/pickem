"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { ProfileCard } from "@/components/ProfileCard";
import { RankPanel } from "@/components/RankPanel";
import { getLevelInfo } from "@/lib/levels";

// A client page (not the server-component-plus-notFound() pattern used by
// /predictor/[team], which validates against a fixed, known team list) -
// usernames are arbitrary and change over time, so "does this one exist"
// has to be a real query, not a static param check. Kept around as a
// direct/shareable URL (notifications, sharing a profile link outside the
// app) - browsing from the leaderboard itself uses PlayerProfileModal's
// popup instead, which renders the same ProfileCard this page does.
export default function PlayerPage() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();
  const [row, setRow] = useState<LeaderboardRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
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
        /* ProfileCard ships without a surface so its two callers can each
           supply their own: the popup gets the modal panel, and the page
           needs this. Without it the profile sat straight on the tiled
           background - loose text on wallpaper. Same RankPanel the
           account page uses, so your own profile and the one strangers
           see are recognisably the same object. */
        <RankPanel
          rankColor={getLevelInfo(row.total_points).rankColor}
          tone="hero"
          className="mt-10 rounded-3xl border border-white/12 bg-[#101d38] px-5 pt-8 pb-6"
        >
          <ProfileCard row={row} stats={stats} myId={user?.id} variant="page" />
        </RankPanel>
      ) : null}
    </main>
  );
}
