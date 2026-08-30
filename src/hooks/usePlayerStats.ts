import { useEffect, useState } from "react";
import { TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { GAMES_BY_WEEK } from "@/data/games";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import { fetchPublicReferralCount } from "@/lib/supabase/referrals";
import { fetchPublicPredictorProgress, fetchPublicWeeklyPickemProgress, fetchPublicLockBonusCount } from "@/lib/supabase/achievements";
import { fetchPublicFriendCount, fetchPublicFollowerCount } from "@/lib/supabase/follows";

const ALL_WEEKS = Object.keys(GAMES_BY_WEEK)
  .map(Number)
  .sort((a, b) => a - b);

export type PlayerStats = {
  referralCount: number;
  followerCount: number;
  friendCount: number;
  completedTeamCount: number;
  completedTeamAbbrs: TeamAbbr[];
  completedWeekCount: number;
  lockBonusCount: number;
};

// Shared by the player profile popup and the standalone /leaderboard/[username]
// page so the two surfaces can't drift - same public reads (RPCs, or
// plain queries against publicly-readable tables/views like follows),
// same "completed" thresholds (REQUIRED_PREDICTOR_WEEKS, each week's own
// game count) as the achievements tab uses for its own version of these
// numbers. completedTeamAbbrs (not just the count) is kept around for
// the Teams Predicted mosaic. Returns null until every fetch has
// resolved.
export function usePlayerStats(userId: string | undefined): PlayerStats | null {
  // Keyed by the user, so nothing has to be cleared when the user
  // changes: what is held belongs to an id, and it only counts if that id
  // is the one being asked about. Two setStates in the effect body came
  // off with it - the early return's and the pre-fetch reset's.
  const [held, setHeld] = useState<{ id: string; stats: PlayerStats } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    Promise.all([
      fetchPublicReferralCount(userId).catch(() => 0),
      fetchPublicFollowerCount(userId).catch(() => 0),
      fetchPublicFriendCount(userId).catch(() => 0),
      fetchPublicPredictorProgress(userId).catch(() => ({}) as Partial<Record<TeamAbbr, number>>),
      fetchPublicWeeklyPickemProgress(userId).catch(() => ({}) as Partial<Record<number, number>>),
      fetchPublicLockBonusCount(userId).catch(() => 0),
    ]).then(([referralCount, followerCount, friendCount, predictorProgress, weeklyProgress, lockBonusCount]) => {
      if (cancelled) return;
      const completedTeamAbbrs = TEAMS_SORTED.filter(
        (t) => (predictorProgress[t.abbr] ?? 0) >= (REQUIRED_PREDICTOR_WEEKS[t.abbr] ?? Infinity)
      ).map((t) => t.abbr);
      const completedWeekCount = ALL_WEEKS.filter((w) => (weeklyProgress[w] ?? 0) >= GAMES_BY_WEEK[w].length).length;
      setHeld({
        id: userId,
        stats: { referralCount, followerCount, friendCount, completedTeamCount: completedTeamAbbrs.length, completedTeamAbbrs, completedWeekCount, lockBonusCount },
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Null until this user's own numbers have landed. Holding somebody
  // else's while a new fetch is in flight is the thing the old clear was
  // preventing, and this prevents it without a render to do it.
  return held && held.id === userId ? held.stats : null;
}
