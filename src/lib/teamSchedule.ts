import { GAMES_BY_WEEK } from "@/data/games";
import { TeamAbbr } from "@/data/teams";

export type TeamScheduleRow = { week: number; away: TeamAbbr; home: TeamAbbr } | { week: number; bye: true };

// Derives a team's full-season schedule (including bye) straight from
// GAMES_BY_WEEK rather than hand-listing it separately, so it can never
// drift out of sync as the real schedule gets filled in/edited.
export function getTeamSchedule(team: TeamAbbr): TeamScheduleRow[] {
  const weeks = Object.keys(GAMES_BY_WEEK)
    .map(Number)
    .sort((a, b) => a - b);

  return weeks.map((week) => {
    const game = GAMES_BY_WEEK[week].find((g) => g.away === team || g.home === team);
    return game ? { week, away: game.away, home: game.home } : { week, bye: true };
  });
}
