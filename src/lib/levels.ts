// The level system. Deliberately just data + a pure function - level is
// never stored in the DB (see point_events in supabase/schema.sql), so
// every number and name here can be retuned later with zero migration,
// once real point sources exist and the curve's actual pace is known.

export type RankTier = { name: string; color: string; emoji: string };

// 10 named ranks x 5 sub-levels = 50 levels. Escalating accent colors so a
// badge reads as "further along" at a glance even before you notice the
// number.
export const RANKS: RankTier[] = [
  { name: "Rookie", color: "#94a3b8", emoji: "🐣" },
  { name: "Practice Squad", color: "#38bdf8", emoji: "🎽" },
  { name: "Special Teams", color: "#22d3ee", emoji: "🎯" },
  { name: "Starter", color: "#34d399", emoji: "🏈" },
  { name: "Team Captain", color: "#4ade80", emoji: "🧢" },
  { name: "Pro Bowler", color: "#facc15", emoji: "🌟" },
  { name: "All-Pro", color: "#fb923c", emoji: "🥇" },
  { name: "MVP", color: "#f87171", emoji: "🏆" },
  { name: "Hall of Famer", color: "#c084fc", emoji: "👑" },
  { name: "GOAT", color: "#f472b6", emoji: "🐐" },
];

const LEVELS_PER_RANK = 5;
export const MAX_LEVEL = RANKS.length * LEVELS_PER_RANK;
const BASE_POINTS = 1500;

// Triangular-number curve: level L costs 1,500*L points on top of the last
// one, so cumulative cost grows quadratically. Level 1 lands exactly on
// the ~1,500 points available from an early feature like filling out a
// team's schedule predictor; level 50 costs just under 2M cumulative -
// a season-plus of sustained play, not a weekend.
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
