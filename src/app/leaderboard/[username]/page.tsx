"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { fetchLeaderboardEntry, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { fetchPublicReferralCount } from "@/lib/supabase/referrals";
import { fetchPublicPredictorProgress } from "@/lib/supabase/achievements";
import { TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import { errorMessage } from "@/lib/errorMessage";
import { useAuth } from "@/hooks/useAuth";
import { FriendButton } from "@/components/FriendButton";
import { LevelBadge } from "@/components/LevelBadge";
import { PlayerBadges } from "@/components/PlayerBadges";
import { LevelListModal } from "@/components/LevelListModal";

// One tile per stat - a plain grid instead of one dominant pill, so
// season record reads as ONE piece of the site instead of the whole
// point. New stats (weekly completion, lock bonuses, whatever ships
// next) are just another entry in the STATS array below, not a
// restructure.
function StatTile({ icon, value, label, accentColor }: { icon: string; value: string; label: string; accentColor: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 flex items-center gap-3">
      <span className="text-2xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-lg leading-none tabular-nums" style={{ fontFamily: "var(--font-display)", color: accentColor }}>
          {value}
        </div>
        <div className="text-[10px] text-white/45 tracking-wide mt-1">{label}</div>
      </div>
    </div>
  );
}

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
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [predictorProgress, setPredictorProgress] = useState<Partial<Record<TeamAbbr, number>> | null>(null);

  useEffect(() => {
    fetchLeaderboardEntry(params.username)
      .then(setRow)
      .catch((err) => setError(errorMessage(err)));
  }, [params.username]);

  useEffect(() => {
    if (!row) return;
    setReferralCount(null);
    setPredictorProgress(null);
    fetchPublicReferralCount(row.user_id)
      .then(setReferralCount)
      .catch(() => setReferralCount(0));
    fetchPublicPredictorProgress(row.user_id)
      .then(setPredictorProgress)
      .catch(() => setPredictorProgress({}));
  }, [row]);

  const completedTeamCount = predictorProgress
    ? TEAMS_SORTED.filter((t) => (predictorProgress[t.abbr] ?? 0) >= (REQUIRED_PREDICTOR_WEEKS[t.abbr] ?? Infinity)).length
    : null;

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

          <div className="w-full mt-8">
            <div className="text-[11px] text-white/45 tracking-[0.15em] mb-2.5">PICK&rsquo;EM</div>
            <div className="grid grid-cols-2 gap-2.5">
              <StatTile icon="🏆" value={`${row.correct}-${row.graded - row.correct}`} label="SEASON RECORD" accentColor="#4ade80" />
              <StatTile icon="🔗" value={referralCount !== null ? String(referralCount) : "–"} label="REFERRALS" accentColor="#c084fc" />
              <StatTile
                icon="🏈"
                value={completedTeamCount !== null ? `${completedTeamCount}/${TEAMS_SORTED.length}` : "–"}
                label="TEAMS PREDICTED"
                accentColor="#38bdf8"
              />
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
