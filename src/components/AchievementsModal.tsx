"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { ACHIEVEMENTS } from "@/data/achievements";
import { TEAMS, TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { GAMES_BY_WEEK } from "@/data/games";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { fetchPredictorProgress, syncPredictorAchievements, fetchWeeklyPickemProgress, syncWeeklyPickemAchievements } from "@/lib/supabase/achievements";
import { fetchWeeks, WeekRow } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/errorMessage";
import { AchievementCard } from "@/components/AchievementCard";

const REQUIRED_PREDICTOR_WEEKS: Partial<Record<TeamAbbr, number>> = {};
for (const team of TEAMS_SORTED) {
  REQUIRED_PREDICTOR_WEEKS[team.abbr] = getTeamSchedule(team.abbr).filter((row) => !("bye" in row)).length;
}

const ALL_WEEKS = Object.keys(GAMES_BY_WEEK)
  .map(Number)
  .sort((a, b) => a - b);

// Same overlay/panel language as LevelListModal - a scrollable body inside
// a fixed-position panel rather than its own route, so it can be reached
// from anywhere (nav, account page) without leaving the page underneath.
export function AchievementsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [predictorProgress, setPredictorProgress] = useState<Partial<Record<TeamAbbr, number>> | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<Partial<Record<number, number>> | null>(null);
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    setPredictorProgress(null);
    setWeeklyProgress(null);
    setError(null);
    Promise.all([syncPredictorAchievements().catch((err) => console.error("Achievement sync failed", err)), syncWeeklyPickemAchievements().catch((err) => console.error("Achievement sync failed", err))]).finally(
      () => {
        fetchPredictorProgress(user.id)
          .then(setPredictorProgress)
          .catch((err) => setError(errorMessage(err)));
        fetchWeeklyPickemProgress(user.id)
          .then(setWeeklyProgress)
          .catch((err) => setError(errorMessage(err)));
        fetchWeeks()
          .then(setWeeks)
          .catch(() => {});
      }
    );
  }, [open, user]);

  if (!open) return null;

  const predictorDef = ACHIEVEMENTS.find((a) => a.key === "predictor_team_complete")!;
  const weeklyDef = ACHIEVEMENTS.find((a) => a.key === "weekly_pickem_complete")!;

  const completedTeams = predictorProgress
    ? TEAMS_SORTED.filter((t) => (predictorProgress[t.abbr] ?? 0) >= (REQUIRED_PREDICTOR_WEEKS[t.abbr] ?? Infinity))
    : [];

  const completedWeeks = weeklyProgress ? ALL_WEEKS.filter((w) => (weeklyProgress[w] ?? 0) >= GAMES_BY_WEEK[w].length) : [];
  const weeksById = new Map(weeks.map((w) => [w.week, w]));

  const loaded = predictorProgress !== null && weeklyProgress !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div>
            <div className="text-[10px] text-white/45 tracking-[0.2em]">EARN POINTS</div>
            <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
              ACHIEVEMENTS
            </h2>
          </div>
          <button
            aria-label="Close"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5">
          {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

          {!loaded ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <AchievementCard
                icon={weeklyDef.icon}
                label={weeklyDef.label}
                description={weeklyDef.description}
                pointsEach={weeklyDef.pointsEach}
                unitLabel={weeklyDef.unitLabel}
                doneCount={completedWeeks.length}
                totalCount={ALL_WEEKS.length}
              >
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {ALL_WEEKS.map((week) => {
                    const required = GAMES_BY_WEEK[week].length;
                    const picked = weeklyProgress![week] ?? 0;
                    const done = picked >= required;
                    const weekRow = weeksById.get(week);
                    const available = weekRow ? weekRow.is_open || weekRow.results_published : false;

                    const cell = (
                      <>
                        <span className="text-sm" style={{ fontFamily: "var(--font-display)" }}>
                          WEEK {week}
                        </span>
                        <span className="text-[10px] text-white/40 mt-0.5">
                          {done ? "Complete" : available ? `${picked}/${required}` : "Locked"}
                        </span>
                      </>
                    );

                    return available ? (
                      <Link
                        key={week}
                        href="/"
                        onClick={onClose}
                        className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 transition-colors ${
                          done ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:border-white/25"
                        }`}
                      >
                        {cell}
                      </Link>
                    ) : (
                      <span key={week} className="flex flex-col items-center gap-0.5 rounded-xl border border-white/5 bg-white/[0.02] px-1 py-2.5 opacity-40">
                        {cell}
                      </span>
                    );
                  })}
                </div>
              </AchievementCard>

              <AchievementCard
                icon={predictorDef.icon}
                label={predictorDef.label}
                description={predictorDef.description}
                pointsEach={predictorDef.pointsEach}
                unitLabel={predictorDef.unitLabel}
                doneCount={completedTeams.length}
                totalCount={TEAMS_SORTED.length}
              >
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {TEAMS_SORTED.map((team) => {
                    const done = completedTeams.some((t) => t.abbr === team.abbr);
                    const filled = predictorProgress![team.abbr] ?? 0;
                    const required = REQUIRED_PREDICTOR_WEEKS[team.abbr] ?? 0;
                    return (
                      <Link
                        key={team.abbr}
                        href={`/predictor/${team.abbr}`}
                        onClick={onClose}
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
              </AchievementCard>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
