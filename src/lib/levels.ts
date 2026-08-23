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

// What it costs to ENTER each rank - the first of its five sub-levels.
//
// Written out rather than generated, because the shape matters more than
// any formula: near-doubling at the sharp end and much steeper multiples
// early, where the numbers are small enough that it does not hurt. The
// first few ranks should fall out of a first week; the last three should
// take years.
//
// The old curve was 150*L triangular, which put GOAT at 162,150 - and a
// referral is worth 1,000, so GOAT was 162 referrals while a PERFECT
// season of everything the app actually pays for was 7,900 points. The
// ladder was a recruiting leaderboard wearing a football hat. 500,000
// makes the recruiting route 500 people, and leaves room for a real
// year-round economy underneath it.
//
// Note what this is NOT: harder across the board. The crossover is
// between All-Pro and MVP, so anyone under ~110,000 points comes out at
// the same rank or a better one. Only the very top of the ladder gets
// further away, which is the half that was broken.
const RANK_ENTRY = [
  100, // Practice Squad - non-zero, or nobody is ever unranked
  500, // Rookie
  2_000, // Role Player
  6_000, // Starter
  15_000, // Team Captain
  32_500, // Pro Bowler
  65_000, // All-Pro
  125_000, // MVP
  250_000, // Hall of Famer
  500_000, // GOAT
];
// Where GOAT V lands. Every other rank runs up to the next rank's entry;
// the last one has no next rank, so it lands ON this instead of
// approaching it.
const MAX_POINTS = 1_000_000;

// Sub-levels inside a rank grow geometrically rather than in five equal
// steps, so the fifth level of a rank is a real step up from the first
// and the ladder has no flat stretches.
function cumulativeForLevel(level: number): number {
  if (level <= 0) return 0;
  const rank = Math.min(Math.floor((level - 1) / LEVELS_PER_RANK), RANKS.length - 1);
  const step = (level - 1) % LEVELS_PER_RANK;
  const from = RANK_ENTRY[rank];
  if (step === 0) return from;
  const isLast = rank === RANKS.length - 1;
  const to = isLast ? MAX_POINTS : RANK_ENTRY[rank + 1];
  // The last rank spans its five levels inclusively so GOAT V is exactly
  // MAX_POINTS; every other rank stops one step short of the next rank's
  // entry, which is that next rank's own first level.
  const span = isLast ? LEVELS_PER_RANK - 1 : LEVELS_PER_RANK;
  return Math.round(from * Math.pow(to / from, step / span));
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
    pointsForThisLevel: cumulativeForLevel(level) - cumulativeForLevel(level - 1),
  };
});
