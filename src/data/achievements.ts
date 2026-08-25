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

// Lives next to the achievement it belongs to, since the link and the
// reward are one thing - change the server and this is the line to
// change. A Discord invite can be revoked or expire; if this one stops
// working, generate a new one and replace it here.
export const DISCORD_INVITE_URL = "https://discord.gg/pcteJyuJXj";

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    key: "daily_check_in",
    label: "Daily Check-In",
    description: "Open Sideline Brew. That's the whole thing.",
    icon: "🔥",
    // Deliberately the smallest number in this file. Showing up is the
    // floor of the economy, not the engine - see the note at the top of
    // supabase/migrations/0043_reprice_economy.sql for what happened the
    // one time it was not.
    pointsEach: 25,
    unitLabel: "days",
  },
  {
    key: "daily_puzzle",
    label: "Daily Game",
    description: "Guess the mystery player in eight tries.",
    icon: "🧠",
    // The headline figure is a perfect solve. Every extra guess costs 25,
    // down to a floor of 125 - see puzzle_points() in
    // supabase/migrations/0046_daily_player_puzzle.sql, which is the only
    // place that number is actually decided.
    pointsEach: 300,
    unitLabel: "solved",
  },
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
    pointsEach: 250,
    unitLabel: "weeks",
  },
  // The three below have no card of their own - they are the reward for
  // being RIGHT, so they belong inside the card for the thing you were
  // right about, and are rendered in its expanded body. They live here
  // anyway so that every number the app promises is in one file.
  {
    key: "correct_pick",
    label: "Correct Pick",
    description: "Win a game on your weekly card.",
    icon: "✅",
    pointsEach: 25,
    unitLabel: "correct picks",
  },
  {
    key: "perfect_week",
    label: "Perfect Week",
    description: "Get every single game in a week right.",
    icon: "💯",
    pointsEach: 1500,
    unitLabel: "perfect weeks",
  },
  {
    key: "predictor_correct",
    label: "Predictor Accuracy",
    description: "Call a game right on a team's season schedule.",
    icon: "🎯",
    pointsEach: 10,
    unitLabel: "correct calls",
  },
  {
    key: "discord_join",
    label: "Join the Discord",
    description: "Come hang out in the Sideline Brew Discord.",
    icon: "💬",
    pointsEach: 250,
    unitLabel: "joined",
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
