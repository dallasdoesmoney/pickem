// The level system. Deliberately just data + a pure function - level is
// never stored in the DB (see point_events in supabase/schema.sql), so
// every number and name here can be retuned later with zero migration,
// once real point sources exist and the curve's actual pace is known.

export type RankTier = { name: string; color: string; emoji: string };

// 10 named ranks x 5 sub-levels = 50 levels. Escalating accent colors so a
// badge reads as "further along" at a glance even before you notice the
// number.
export const RANKS: RankTier[] = [
  { name: "Practice Squad", color: "#94a3b8", emoji: "🎽" },
  { name: "Rookie", color: "#38bdf8", emoji: "🐣" },
  { name: "Role Player", color: "#2dd4bf", emoji: "🧩" },
  { name: "Starter", color: "#4ade80", emoji: "🏈" },
  { name: "Team Captain", color: "#a3e635", emoji: "🧢" },
  { name: "Pro Bowler", color: "#facc15", emoji: "🌟" },
  { name: "All-Pro", color: "#fb923c", emoji: "🥇" },
  { name: "MVP", color: "#f87171", emoji: "🏆" },
  { name: "Hall of Famer", color: "#c084fc", emoji: "👑" },
  { name: "GOAT", color: "#f472b6", emoji: "🐐" },
];

export const LEVELS_PER_RANK = 5;
export const MAX_LEVEL = RANKS.length * LEVELS_PER_RANK;
const BASE_POINTS = 150;

// Triangular-number curve: level L costs 150*L points on top of the last
// one, so cumulative cost grows quadratically - levels 26-50 alone account
// for ~75% of the total climb to GOAT. Calibrated against a future
// year-round daily-games economy (up to 500 pts/day): GOAT (191,250 pts)
// takes roughly a year for someone who hits the daily max every single
// day, and more like 2+ years for a realistic dedicated player accounting
// for a quieter off-season - hard, not impossible. Early levels still
// clear fast off one-time achievements (predictor + weekly pick'em +
// onboarding bonus), which is the point - fast early payoff, brutal climb
// at the top.
function cumulativeForLevel(level: number): number {
  return (BASE_POINTS * (level * (level + 1))) / 2;
}

export type LevelInfo = {
  level: number;
  isUnranked: boolean;
  isMaxLevel: boolean;
  rankName: string;
  rankColor: string;
  rankEmoji: string;
  subLevel: number; // 1-5 within the rank, 0 if unranked
  pointsIntoLevel: number;
  pointsForNextLevel: number | null;
  progress: number; // 0-1 toward the next level
  totalPoints: number;
};

function rankForLevel(level: number): RankTier {
  return RANKS[Math.min(Math.floor((Math.max(level, 1) - 1) / LEVELS_PER_RANK), RANKS.length - 1)];
}

export function getLevelInfo(totalPoints: number): LevelInfo {
  let level = 0;
  while (level < MAX_LEVEL && totalPoints >= cumulativeForLevel(level + 1)) level++;

  const isUnranked = level === 0;
  const rank = rankForLevel(level);
  const subLevel = isUnranked ? 0 : ((level - 1) % LEVELS_PER_RANK) + 1;

  const floor = cumulativeForLevel(level);
  const isMaxLevel = level >= MAX_LEVEL;
  const nextThreshold = isMaxLevel ? null : cumulativeForLevel(level + 1);

  return {
    level,
    isUnranked,
    isMaxLevel,
    rankName: rank.name,
    rankColor: rank.color,
    rankEmoji: rank.emoji,
    subLevel,
    pointsIntoLevel: totalPoints - floor,
    pointsForNextLevel: nextThreshold === null ? null : nextThreshold - floor,
    progress: nextThreshold === null ? 1 : (totalPoints - floor) / (nextThreshold - floor),
    totalPoints,
  };
}

const ROMAN = ["I", "II", "III", "IV", "V"];
export function subLevelRoman(subLevel: number): string {
  return ROMAN[subLevel - 1] ?? String(subLevel);
}

export type LevelListEntry = {
  level: number;
  rankName: string;
  rankColor: string;
  rankEmoji: string;
  subLevel: number;
  cumulativePoints: number;
  pointsForThisLevel: number;
};

// The full ladder, for a "see every level" view - built once and reused
// rather than recomputed per render.
export const ALL_LEVELS: LevelListEntry[] = Array.from({ length: MAX_LEVEL }, (_, i) => {
  const level = i + 1;
  const rank = rankForLevel(level);
  return {
    level,
    rankName: rank.name,
    rankColor: rank.color,
    rankEmoji: rank.emoji,
    subLevel: ((level - 1) % LEVELS_PER_RANK) + 1,
    cumulativePoints: cumulativeForLevel(level),
    pointsForThisLevel: BASE_POINTS * level,
  };
});
