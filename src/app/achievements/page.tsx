"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TEAMS, TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { fetchPredictorProgress, syncPredictorAchievements } from "@/lib/supabase/achievements";
import { errorMessage } from "@/lib/errorMessage";

const REQUIRED_WEEKS: Partial<Record<TeamAbbr, number>> = {};
for (const team of TEAMS_SORTED) {
  REQUIRED_WEEKS[team.abbr] = getTeamSchedule(team.abbr).filter((row) => !("bye" in row)).length;
}

export default function AchievementsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [progress, setProgress] = useState<Partial<Record<TeamAbbr, number>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/account");
      return;
    }
    syncPredictorAchievements()
      .catch((err) => console.error("Achievement sync failed", err))
      .finally(() => {
        fetchPredictorProgress(user.id)
          .then(setProgress)
          .catch((err) => setError(errorMessage(err)));
      });
  }, [user, loading, router]);

  const predictorDef = ACHIEVEMENTS.find((a) => a.key === "predictor_team_complete")!;
  const completedTeams = progress
    ? TEAMS_SORTED.filter((t) => (progress[t.abbr] ?? 0) >= (REQUIRED_WEEKS[t.abbr] ?? Infinity))
    : [];

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">EARN POINTS</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          ACHIEVEMENTS
        </h1>
      </div>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {!progress ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-start gap-3">
            <span className="text-3xl shrink-0">{predictorDef.icon}</span>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
                {predictorDef.label}
              </h2>
              <p className="text-xs text-white/50 mt-0.5">{predictorDef.description}</p>
              <p className="text-xs text-emerald-400 mt-1" style={{ fontFamily: "var(--font-display)" }}>
                {predictorDef.pointsEach} PTS EACH
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 mb-2">
            <span className="text-xs text-white/50">
              {completedTeams.length} / {TEAMS_SORTED.length} teams
            </span>
            <span className="text-xs text-white/50" style={{ fontFamily: "var(--font-display)" }}>
              {completedTeams.length * predictorDef.pointsEach} pts earned
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-emerald-400"
              style={{ width: `${(completedTeams.length / TEAMS_SORTED.length) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {TEAMS_SORTED.map((team) => {
              const done = completedTeams.some((t) => t.abbr === team.abbr);
              const filled = progress[team.abbr] ?? 0;
              const required = REQUIRED_WEEKS[team.abbr] ?? 0;
              return (
                <Link
                  key={team.abbr}
                  href={`/predictor/${team.abbr}`}
                  title={done ? `${team.city} ${team.name} — complete` : `${team.city} ${team.name} — ${filled}/${required}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2 transition-colors ${
                    done ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:border-white/25"
                  }`}
                >
                  <img src={TEAMS[team.abbr].logo} alt="" className={`h-6 w-6 object-contain ${done ? "" : "opacity-40"}`} />
                  <span className={`text-[9px] ${done ? "text-emerald-300" : "text-white/40"}`}>{team.abbr}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </main>
  );
}
