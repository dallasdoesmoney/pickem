import { useEffect, useState } from "react";
import { TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { GAMES_BY_WEEK } from "@/data/games";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import { fetchPublicReferralCount } from "@/lib/supabase/referrals";
import { fetchPublicPredictorProgress, fetchPublicWeeklyPickemProgress, fetchPublicLockBonusCount } from "@/lib/supabase/achievements";

const ALL_WEEKS = Object.keys(GAMES_BY_WEEK)
  .map(Number)
  .sort((a, b) => a - b);

export type PlayerStats = {
  referralCount: number;
  completedTeamCount: number;
  completedWeekCount: number;
  lockBonusCount: number;
};

// Shared by the player profile popup and the standalone /leaderboard/[username]
// page so the two surfaces can't drift - same four public RPCs (see
// supabase/schema.sql), same "completed" thresholds (REQUIRED_PREDICTOR_WEEKS,
// each week's own game count) as the achievements tab uses for its own
// version of these numbers. Returns null until every fetch has resolved.
export function usePlayerStats(userId: string | undefined): PlayerStats | null {
  const [stats, setStats] = useState<PlayerStats | null>(null);

  useEffect(() => {
    if (!userId) {
      setStats(null);
      return;
    }
    let cancelled = false;
    setStats(null);
    Promise.all([
      fetchPublicReferralCount(userId).catch(() => 0),
      fetchPublicPredictorProgress(userId).catch(() => ({}) as Partial<Record<TeamAbbr, number>>),
      fetchPublicWeeklyPickemProgress(userId).catch(() => ({}) as Partial<Record<number, number>>),
      fetchPublicLockBonusCount(userId).catch(() => 0),
    ]).then(([referralCount, predictorProgress, weeklyProgress, lockBonusCount]) => {
      if (cancelled) return;
      const completedTeamCount = TEAMS_SORTED.filter(
        (t) => (predictorProgress[t.abbr] ?? 0) >= (REQUIRED_PREDICTOR_WEEKS[t.abbr] ?? Infinity)
      ).length;
      const completedWeekCount = ALL_WEEKS.filter((w) => (weeklyProgress[w] ?? 0) >= GAMES_BY_WEEK[w].length).length;
      setStats({ referralCount, completedTeamCount, completedWeekCount, lockBonusCount });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return stats;
}
