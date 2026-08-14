import { TeamAbbr } from "./teams";

// Vegas season win-total lines (over/under), for comparing against a
// predicted record on the Schedule Predictor page. These move throughout
// the offseason - only Dallas is filled in for now as a working example;
// update/add teams here as real lines come in.
export const WIN_TOTALS: Partial<Record<TeamAbbr, number>> = {
  DAL: 9.5,
};
