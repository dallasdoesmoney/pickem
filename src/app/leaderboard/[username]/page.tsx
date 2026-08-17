"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { FriendButton } from "@/components/FriendButton";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { LevelListModal } from "@/components/LevelListModal";

// A client page (not the server-component-plus-notFound() pattern used by
// /predictor/[team], which validates against a fixed, known team list) -
// usernames are arbitrary and change over time, so "does this one exist"
// has to be a real query, not a static param check.
export default function PlayerPage() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();
  const [row, setRow] = useState<LeaderboardRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [levelModalOpen, setLevelModalOpen] = useState(false);

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
            <LevelBadge totalPoints={row.total_points} size="lg" />
          </div>
          <button type="button" onClick={() => setLevelModalOpen(true)} className="text-[11px] text-white/35 hover:text-white/60 transition-colors">
            View all levels &rarr;
          </button>
          <p className="text-white/45 text-sm mt-1">@{row.username}</p>
          <PlayerBadges userId={row.user_id} />

          <div
            className="mt-8 rounded-full border-2 border-emerald-400 text-center flex flex-col items-center justify-center w-[160px] h-[100px]"
            style={{ background: "#1b2947", boxShadow: "0 6px 16px -6px rgba(0,0,0,0.5)" }}
          >
            <div className="text-3xl leading-none" style={{ fontFamily: "var(--font-display)" }}>
              {row.correct}-{row.graded - row.correct}
            </div>
            <div className="text-[11px] text-white/55 mt-1.5 tracking-wide">SEASON RECORD</div>
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
