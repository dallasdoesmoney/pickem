import { TeamAbbr } from "@/data/teams";

// 2026 pre-season power rankings, 1 = best. Drives the "suspicious pick"
// dog meme on the Schedule Predictor: picking a team to beat an opponent
// ranked notably better earns the side-eye.
// Source: NFL.com preseason power rankings (Aug 2026).
export const POWER_RANKINGS: Partial<Record<TeamAbbr, number>> = {
  LAR: 1,
  DEN: 2,
  SEA: 3,
  PHI: 4,
  BUF: 5,
  BAL: 6,
  JAX: 7,
  CIN: 8,
  HOU: 9,
  CHI: 10,
  DAL: 11,
  NE: 12,
  GB: 13,
  DET: 14,
  KC: 15,
  SF: 16,
  LAC: 17,
  MIN: 18,
  IND: 19,
  PIT: 20,
  NO: 21,
  TB: 22,
  CAR: 23,
  TEN: 24,
  ATL: 25,
  ARI: 26,
  NYG: 27,
  CLE: 28,
  WAS: 29,
  NYJ: 30,
  LV: 31,
  MIA: 32,
};

// How many spots better the opponent must be ranked before a pick counts
// as suspicious. Road wins are harder, so an away pick earns the side-eye
// at a smaller gap than a home pick does.
export const SUSPICIOUS_RANK_GAP_AWAY = 6;
export const SUSPICIOUS_RANK_GAP_HOME = 8;

export function isSuspiciousPick(winner: TeamAbbr, loser: TeamAbbr, winnerIsHome: boolean): boolean {
  const winnerRank = POWER_RANKINGS[winner];
  const loserRank = POWER_RANKINGS[loser];
  if (winnerRank === undefined || loserRank === undefined) return false;
  const gap = winnerIsHome ? SUSPICIOUS_RANK_GAP_HOME : SUSPICIOUS_RANK_GAP_AWAY;
  return winnerRank - loserRank >= gap;
}
