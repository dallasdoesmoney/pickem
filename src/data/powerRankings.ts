import { TeamAbbr } from "@/data/teams";

// Pre-season power rankings, 1 = best. Drives the "suspicious pick" dog
// meme on the Schedule Predictor: picking a team to beat an opponent
// ranked SUSPICIOUS_RANK_GAP or more spots better earns the side-eye.
//
// TODO - PLACEHOLDER ordering so the feature is testable. Replace with
// Dallas's real power rankings before this goes live.
export const POWER_RANKINGS: Partial<Record<TeamAbbr, number>> = {
  PHI: 1,
  BUF: 2,
  BAL: 3,
  KC: 4,
  DET: 5,
  SF: 6,
  GB: 7,
  CIN: 8,
  LAR: 9,
  HOU: 10,
  MIN: 11,
  TB: 12,
  LAC: 13,
  PIT: 14,
  WAS: 15,
  DEN: 16,
  SEA: 17,
  DAL: 18,
  ATL: 19,
  ARI: 20,
  MIA: 21,
  CHI: 22,
  IND: 23,
  NYJ: 24,
  JAX: 25,
  NE: 26,
  LV: 27,
  NO: 28,
  CAR: 29,
  NYG: 30,
  TEN: 31,
  CLE: 32,
};

// How many spots better the opponent must be ranked before a pick counts
// as suspicious.
export const SUSPICIOUS_RANK_GAP = 8;

export function isSuspiciousPick(winner: TeamAbbr, loser: TeamAbbr): boolean {
  const winnerRank = POWER_RANKINGS[winner];
  const loserRank = POWER_RANKINGS[loser];
  if (winnerRank === undefined || loserRank === undefined) return false;
  return winnerRank - loserRank >= SUSPICIOUS_RANK_GAP;
}
