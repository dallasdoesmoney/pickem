// Catalog of achievements - what earns points and how much. Each has its
// own server-side award logic (see supabase/schema.sql's sync_* functions)
// and its own instance renderer on the achievements page, since a "team"
// instance (predictor) and a "week" instance (weekly pick'em) need
// different progress UI.
export type AchievementDef = {
  key: string;
  label: string;
  description: string;
  icon: string;
  pointsEach: number;
  unitLabel: string;
};

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "predictor_team_complete",
    label: "Season Predictor",
    description: "Predict the outcome of every game on a team's schedule.",
    icon: "📋",
    pointsEach: 50,
    unitLabel: "teams",
  },
  {
    key: "weekly_pickem_complete",
    label: "Weekly Pick'em",
    description: "Make a pick for every game in a week.",
    icon: "🏈",
    pointsEach: 100,
    unitLabel: "weeks",
  },
  {
    key: "referral",
    label: "Invite Friends",
    description: "Get a friend to sign up using your invite link.",
    icon: "🎉",
    pointsEach: 1000,
    unitLabel: "referrals",
  },
  {
    key: "lock_correct",
    label: "Lock of the Week",
    description: "Mark one weekly pick as your lock and get it right.",
    icon: "🔒",
    pointsEach: 250,
    unitLabel: "correct locks",
  },
];
