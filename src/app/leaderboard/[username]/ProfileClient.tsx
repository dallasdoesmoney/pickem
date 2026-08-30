"use client";

import Link from "next/link";
import { LeaderboardRow } from "@/lib/supabase/leaderboard";
import { usePlayerStats } from "@/hooks/usePlayerStats";
import { useAuth } from "@/hooks/useAuth";
import { ProfileCard } from "@/components/ProfileCard";
import { RankPanel } from "@/components/RankPanel";
import { getLevelInfo } from "@/lib/levels";

// The interactive half of the profile: the follow button, the modals the
// stat tiles open, and the live counts usePlayerStats fetches. The row
// itself arrives as a prop, already fetched on the server, which is the
// whole point of the split - a crawler and a person who has just tapped a
// shared link both get the name and the record in the first response,
// rather than a spinner and a promise that JavaScript will fill it in.
export function ProfileClient({ row }: { row: LeaderboardRow }) {
  const { user } = useAuth();
  const stats = usePlayerStats(row.user_id);

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <Link href="/leaderboard" className="text-xs text-white/40 hover:text-white/70 transition-colors">
        &larr; Back to leaderboard
      </Link>

      {/* ProfileCard ships without a surface so its two callers can each
          supply their own: the popup gets the modal panel, and the page
          needs this. Without it the profile sat straight on the tiled
          background - loose text on wallpaper. Same RankPanel the account
          page uses, so your own profile and the one strangers see are
          recognisably the same object. */}
      <RankPanel
        rankColor={getLevelInfo(row.total_points).rankColor}
        tone="hero"
        className="mt-10 rounded-3xl border border-white/12 bg-[#101d38] px-5 pt-8 pb-6"
      >
        <ProfileCard row={row} stats={stats} myId={user?.id} variant="page" />
      </RankPanel>
    </main>
  );
}
