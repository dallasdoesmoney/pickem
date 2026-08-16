import { GAMES_BY_WEEK } from "@/data/games";
import { TEAMS_SORTED, TeamAbbr } from "@/data/teams";

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

// Non-bye weeks per team - "fully predicted" means a pick for every one of
// these. Computed once from static schedule data and shared by anywhere
// that needs to know a team's predictor completion (achievements modal,
// the team picker landing page).
export const REQUIRED_PREDICTOR_WEEKS: Partial<Record<TeamAbbr, number>> = {};
for (const team of TEAMS_SORTED) {
  REQUIRED_PREDICTOR_WEEKS[team.abbr] = getTeamSchedule(team.abbr).filter((row) => !("bye" in row)).length;
}
