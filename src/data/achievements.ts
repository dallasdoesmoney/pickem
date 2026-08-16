// Catalog of achievements - what earns points and how much. Only one
// exists for real right now (season predictor completion); more get
// appended here as new point sources ship, each with its own
// server-side award logic (see supabase/migrations for the SQL side of
// this one).
export type AchievementDef = {
  key: string;
  label: string;
  description: string;
  icon: string;
  pointsEach: number;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "predictor_team_complete",
    label: "Season Predictor",
    description: "Predict the outcome of every game on a team's schedule.",
    icon: "📋",
    pointsEach: 50,
  },
];
