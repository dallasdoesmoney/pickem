import { TeamAbbr } from "./teams";

export type Game = {
  id: string;
  week: number;
  away: TeamAbbr;
  home: TeamAbbr;
  kickoff: string; // ISO 8601 with offset
  network: string;
};

export const WEEK_1_GAMES: Game[] = [
  { id: "2026-w1-ne-sea", week: 1, away: "NE", home: "SEA", kickoff: "2026-09-09T20:20:00-04:00", network: "NBC" },
  { id: "2026-w1-lar-sf", week: 1, away: "LAR", home: "SF", kickoff: "2026-09-10T20:35:00-04:00", network: "Netflix" },
  { id: "2026-w1-chi-car", week: 1, away: "CHI", home: "CAR", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX" },
  { id: "2026-w1-tb-cin", week: 1, away: "TB", home: "CIN", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX" },
  { id: "2026-w1-no-det", week: 1, away: "NO", home: "DET", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX" },
  { id: "2026-w1-atl-pit", week: 1, away: "ATL", home: "PIT", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX" },
  { id: "2026-w1-buf-hou", week: 1, away: "BUF", home: "HOU", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS" },
  { id: "2026-w1-bal-ind", week: 1, away: "BAL", home: "IND", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS" },
  { id: "2026-w1-cle-jax", week: 1, away: "CLE", home: "JAX", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS" },
  { id: "2026-w1-nyj-ten", week: 1, away: "NYJ", home: "TEN", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS" },
  { id: "2026-w1-ari-lac", week: 1, away: "ARI", home: "LAC", kickoff: "2026-09-13T16:25:00-04:00", network: "CBS" },
  { id: "2026-w1-gb-min", week: 1, away: "GB", home: "MIN", kickoff: "2026-09-13T16:25:00-04:00", network: "CBS" },
  { id: "2026-w1-mia-lv", week: 1, away: "MIA", home: "LV", kickoff: "2026-09-13T16:25:00-04:00", network: "FOX" },
  { id: "2026-w1-was-phi", week: 1, away: "WAS", home: "PHI", kickoff: "2026-09-13T16:25:00-04:00", network: "FOX" },
  { id: "2026-w1-dal-nyg", week: 1, away: "DAL", home: "NYG", kickoff: "2026-09-13T20:20:00-04:00", network: "NBC" },
  { id: "2026-w1-den-kc", week: 1, away: "DEN", home: "KC", kickoff: "2026-09-14T20:15:00-04:00", network: "ESPN" },
];

// To add a new week: copy the WEEK_1_GAMES array above, rename it
// (e.g. WEEK_2_GAMES), fill in that week's real matchups, register it
// below, and bump CURRENT_WEEK. Team colors/logos in teams.ts don't
// need to change — every team abbreviation already resolves there.
export const GAMES_BY_WEEK: Record<number, Game[]> = {
  1: WEEK_1_GAMES,
};

export const CURRENT_WEEK = 1;
