import { TeamAbbr } from "./teams";

export type Game = {
  id: string;
  week: number;
  away: TeamAbbr;
  home: TeamAbbr;
  kickoff: string; // ISO 8601 with offset
  network: string;
  favorite?: TeamAbbr; // point-spread favorite, if known
  spread?: number; // points favored by, always positive
  awayRecord?: string; // e.g. "3-1" - defaults to "0-0" when unset
  homeRecord?: string;
};

// Spread/favorite values below are placeholder examples to demo the UI -
// real lines move right up until kickoff, so plug in current numbers each
// week rather than trusting anything hardcoded here.
// Kept in strict kickoff order (earliest to latest) - the app doesn't
// re-sort games within a day group, it trusts this array's own order, so
// this ordering is what actually keeps the 1pm ET slate listed before the
// 4:25pm ET slate on the page.
export const WEEK_1_GAMES: Game[] = [
  { id: "2026-w1-ne-sea", week: 1, away: "NE", home: "SEA", kickoff: "2026-09-09T20:20:00-04:00", network: "NBC", favorite: "SEA", spread: 3.5 },
  // Neutral-site game (Melbourne, Australia) - LAR is the designated home
  // team of record, not SF, so away/home are swapped from what the
  // matchup name order might suggest.
  { id: "2026-w1-lar-sf", week: 1, away: "SF", home: "LAR", kickoff: "2026-09-10T20:35:00-04:00", network: "Netflix", favorite: "LAR", spread: 3.5 },
  { id: "2026-w1-tb-cin", week: 1, away: "TB", home: "CIN", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX", favorite: "CIN", spread: 3.5 },
  { id: "2026-w1-no-det", week: 1, away: "NO", home: "DET", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX", favorite: "DET", spread: 7 },
  { id: "2026-w1-nyj-ten", week: 1, away: "NYJ", home: "TEN", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS", favorite: "TEN", spread: 3 },
  { id: "2026-w1-bal-ind", week: 1, away: "BAL", home: "IND", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS", favorite: "BAL", spread: 3.5 },
  { id: "2026-w1-atl-pit", week: 1, away: "ATL", home: "PIT", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX", favorite: "PIT", spread: 3 },
  { id: "2026-w1-chi-car", week: 1, away: "CHI", home: "CAR", kickoff: "2026-09-13T13:00:00-04:00", network: "FOX", favorite: "CHI", spread: 2.5 },
  { id: "2026-w1-cle-jax", week: 1, away: "CLE", home: "JAX", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS", favorite: "JAX", spread: 7.5 },
  { id: "2026-w1-buf-hou", week: 1, away: "BUF", home: "HOU", kickoff: "2026-09-13T13:00:00-04:00", network: "CBS", favorite: "BUF", spread: 1.5 },
  { id: "2026-w1-mia-lv", week: 1, away: "MIA", home: "LV", kickoff: "2026-09-13T16:25:00-04:00", network: "FOX", favorite: "LV", spread: 3.5 },
  { id: "2026-w1-gb-min", week: 1, away: "GB", home: "MIN", kickoff: "2026-09-13T16:25:00-04:00", network: "CBS", favorite: "MIN", spread: 1.5 },
  { id: "2026-w1-was-phi", week: 1, away: "WAS", home: "PHI", kickoff: "2026-09-13T16:25:00-04:00", network: "FOX", favorite: "PHI", spread: 4.5 },
  { id: "2026-w1-ari-lac", week: 1, away: "ARI", home: "LAC", kickoff: "2026-09-13T16:25:00-04:00", network: "CBS", favorite: "LAC", spread: 10.5 },
  { id: "2026-w1-dal-nyg", week: 1, away: "DAL", home: "NYG", kickoff: "2026-09-13T20:20:00-04:00", network: "NBC", favorite: "DAL", spread: 2.5 },
  { id: "2026-w1-den-kc", week: 1, away: "DEN", home: "KC", kickoff: "2026-09-14T20:15:00-04:00", network: "ESPN", favorite: "KC", spread: 3 },
];

export const WEEK_2_GAMES: Game[] = [
  { id: "2026-w2-det-buf", week: 2, away: "DET", home: "BUF", kickoff: "2026-09-17T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w2-car-atl", week: 2, away: "CAR", home: "ATL", kickoff: "2026-09-20T13:00:00-04:00", network: "FOX" },
  { id: "2026-w2-no-bal", week: 2, away: "NO", home: "BAL", kickoff: "2026-09-20T13:00:00-04:00", network: "CBS" },
  { id: "2026-w2-min-chi", week: 2, away: "MIN", home: "CHI", kickoff: "2026-09-20T13:00:00-04:00", network: "FOX" },
  { id: "2026-w2-cin-hou", week: 2, away: "CIN", home: "HOU", kickoff: "2026-09-20T13:00:00-04:00", network: "CBS" },
  { id: "2026-w2-pit-ne", week: 2, away: "PIT", home: "NE", kickoff: "2026-09-20T13:00:00-04:00", network: "CBS" },
  { id: "2026-w2-gb-nyj", week: 2, away: "GB", home: "NYJ", kickoff: "2026-09-20T13:00:00-04:00", network: "FOX" },
  { id: "2026-w2-cle-tb", week: 2, away: "CLE", home: "TB", kickoff: "2026-09-20T13:00:00-04:00", network: "CBS" },
  { id: "2026-w2-phi-ten", week: 2, away: "PHI", home: "TEN", kickoff: "2026-09-20T13:00:00-04:00", network: "FOX" },
  { id: "2026-w2-jax-den", week: 2, away: "JAX", home: "DEN", kickoff: "2026-09-20T16:05:00-04:00", network: "CBS" },
  { id: "2026-w2-lv-lac", week: 2, away: "LV", home: "LAC", kickoff: "2026-09-20T16:05:00-04:00", network: "CBS" },
  { id: "2026-w2-sea-ari", week: 2, away: "SEA", home: "ARI", kickoff: "2026-09-20T16:25:00-04:00", network: "FOX" },
  { id: "2026-w2-was-dal", week: 2, away: "WAS", home: "DAL", kickoff: "2026-09-20T16:25:00-04:00", network: "FOX" },
  { id: "2026-w2-mia-sf", week: 2, away: "MIA", home: "SF", kickoff: "2026-09-20T16:25:00-04:00", network: "FOX" },
  { id: "2026-w2-ind-kc", week: 2, away: "IND", home: "KC", kickoff: "2026-09-20T20:20:00-04:00", network: "NBC" },
  { id: "2026-w2-nyg-lar", week: 2, away: "NYG", home: "LAR", kickoff: "2026-09-21T20:15:00-04:00", network: "ESPN" },
];

export const WEEK_3_GAMES: Game[] = [
  { id: "2026-w3-atl-gb", week: 3, away: "ATL", home: "GB", kickoff: "2026-09-24T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w3-lac-buf", week: 3, away: "LAC", home: "BUF", kickoff: "2026-09-27T13:00:00-04:00", network: "FOX" },
  { id: "2026-w3-car-cle", week: 3, away: "CAR", home: "CLE", kickoff: "2026-09-27T13:00:00-04:00", network: "FOX" },
  { id: "2026-w3-nyj-det", week: 3, away: "NYJ", home: "DET", kickoff: "2026-09-27T13:00:00-04:00", network: "FOX" },
  { id: "2026-w3-hou-ind", week: 3, away: "HOU", home: "IND", kickoff: "2026-09-27T13:00:00-04:00", network: "CBS" },
  { id: "2026-w3-ne-jax", week: 3, away: "NE", home: "JAX", kickoff: "2026-09-27T13:00:00-04:00", network: "CBS" },
  { id: "2026-w3-kc-mia", week: 3, away: "KC", home: "MIA", kickoff: "2026-09-27T13:00:00-04:00", network: "CBS" },
  { id: "2026-w3-ten-nyg", week: 3, away: "TEN", home: "NYG", kickoff: "2026-09-27T13:00:00-04:00", network: "CBS" },
  { id: "2026-w3-cin-pit", week: 3, away: "CIN", home: "PIT", kickoff: "2026-09-27T13:00:00-04:00", network: "CBS" },
  { id: "2026-w3-sea-was", week: 3, away: "SEA", home: "WAS", kickoff: "2026-09-27T13:00:00-04:00", network: "FOX" },
  { id: "2026-w3-ari-sf", week: 3, away: "ARI", home: "SF", kickoff: "2026-09-27T16:05:00-04:00", network: "FOX" },
  { id: "2026-w3-min-tb", week: 3, away: "MIN", home: "TB", kickoff: "2026-09-27T16:05:00-04:00", network: "FOX" },
  { id: "2026-w3-lv-no", week: 3, away: "LV", home: "NO", kickoff: "2026-09-27T16:25:00-04:00", network: "CBS" },
  { id: "2026-w3-bal-dal", week: 3, away: "BAL", home: "DAL", kickoff: "2026-09-27T16:25:00-04:00", network: "CBS" },
  { id: "2026-w3-lar-den", week: 3, away: "LAR", home: "DEN", kickoff: "2026-09-27T20:20:00-04:00", network: "NBC" },
  { id: "2026-w3-phi-chi", week: 3, away: "PHI", home: "CHI", kickoff: "2026-09-28T20:15:00-04:00", network: "ESPN" },
];

export const WEEK_4_GAMES: Game[] = [
  { id: "2026-w4-pit-cle", week: 4, away: "PIT", home: "CLE", kickoff: "2026-10-01T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w4-ind-was", week: 4, away: "IND", home: "WAS", kickoff: "2026-10-04T09:30:00-04:00", network: "NFL Network" },
  { id: "2026-w4-ten-bal", week: 4, away: "TEN", home: "BAL", kickoff: "2026-10-04T13:00:00-04:00", network: "CBS" },
  { id: "2026-w4-ne-buf", week: 4, away: "NE", home: "BUF", kickoff: "2026-10-04T13:00:00-04:00", network: "CBS" },
  { id: "2026-w4-nyj-chi", week: 4, away: "NYJ", home: "CHI", kickoff: "2026-10-04T13:00:00-04:00", network: "FOX" },
  { id: "2026-w4-jax-cin", week: 4, away: "JAX", home: "CIN", kickoff: "2026-10-04T13:00:00-04:00", network: "CBS" },
  { id: "2026-w4-dal-hou", week: 4, away: "DAL", home: "HOU", kickoff: "2026-10-04T13:00:00-04:00", network: "FOX" },
  { id: "2026-w4-ari-nyg", week: 4, away: "ARI", home: "NYG", kickoff: "2026-10-04T13:00:00-04:00", network: "CBS" },
  { id: "2026-w4-lar-phi", week: 4, away: "LAR", home: "PHI", kickoff: "2026-10-04T13:00:00-04:00", network: "FOX" },
  { id: "2026-w4-gb-tb", week: 4, away: "GB", home: "TB", kickoff: "2026-10-04T13:00:00-04:00", network: "FOX" },
  { id: "2026-w4-mia-min", week: 4, away: "MIA", home: "MIN", kickoff: "2026-10-04T16:05:00-04:00", network: "FOX" },
  { id: "2026-w4-kc-lv", week: 4, away: "KC", home: "LV", kickoff: "2026-10-04T16:25:00-04:00", network: "CBS" },
  { id: "2026-w4-lac-sea", week: 4, away: "LAC", home: "SEA", kickoff: "2026-10-04T16:25:00-04:00", network: "CBS" },
  { id: "2026-w4-den-sf", week: 4, away: "DEN", home: "SF", kickoff: "2026-10-04T16:25:00-04:00", network: "CBS" },
  { id: "2026-w4-det-car", week: 4, away: "DET", home: "CAR", kickoff: "2026-10-04T20:20:00-04:00", network: "NBC" },
  { id: "2026-w4-atl-no", week: 4, away: "ATL", home: "NO", kickoff: "2026-10-05T20:15:00-04:00", network: "ESPN" },
];

export const WEEK_5_GAMES: Game[] = [
  { id: "2026-w5-tb-dal", week: 5, away: "TB", home: "DAL", kickoff: "2026-10-08T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w5-phi-jax", week: 5, away: "PHI", home: "JAX", kickoff: "2026-10-11T09:30:00-04:00", network: "NFL Network" },
  { id: "2026-w5-cin-mia", week: 5, away: "CIN", home: "MIA", kickoff: "2026-10-11T13:00:00-04:00", network: "FOX" },
  { id: "2026-w5-lv-ne", week: 5, away: "LV", home: "NE", kickoff: "2026-10-11T13:00:00-04:00", network: "CBS" },
  { id: "2026-w5-min-no", week: 5, away: "MIN", home: "NO", kickoff: "2026-10-11T13:00:00-04:00", network: "FOX" },
  { id: "2026-w5-cle-nyj", week: 5, away: "CLE", home: "NYJ", kickoff: "2026-10-11T13:00:00-04:00", network: "CBS" },
  { id: "2026-w5-ind-pit", week: 5, away: "IND", home: "PIT", kickoff: "2026-10-11T13:00:00-04:00", network: "CBS" },
  { id: "2026-w5-hou-ten", week: 5, away: "HOU", home: "TEN", kickoff: "2026-10-11T13:00:00-04:00", network: "CBS" },
  { id: "2026-w5-nyg-was", week: 5, away: "NYG", home: "WAS", kickoff: "2026-10-11T13:00:00-04:00", network: "FOX" },
  { id: "2026-w5-den-lac", week: 5, away: "DEN", home: "LAC", kickoff: "2026-10-11T16:05:00-04:00", network: "CBS" },
  { id: "2026-w5-det-ari", week: 5, away: "DET", home: "ARI", kickoff: "2026-10-11T16:25:00-04:00", network: "FOX" },
  { id: "2026-w5-chi-gb", week: 5, away: "CHI", home: "GB", kickoff: "2026-10-11T16:25:00-04:00", network: "FOX" },
  { id: "2026-w5-sf-sea", week: 5, away: "SF", home: "SEA", kickoff: "2026-10-11T16:25:00-04:00", network: "FOX" },
  { id: "2026-w5-bal-atl", week: 5, away: "BAL", home: "ATL", kickoff: "2026-10-11T20:20:00-04:00", network: "NBC" },
  { id: "2026-w5-buf-lar", week: 5, away: "BUF", home: "LAR", kickoff: "2026-10-12T20:15:00-04:00", network: "ESPN" },
];

export const WEEK_6_GAMES: Game[] = [
  { id: "2026-w6-sea-den", week: 6, away: "SEA", home: "DEN", kickoff: "2026-10-15T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w6-hou-jax", week: 6, away: "HOU", home: "JAX", kickoff: "2026-10-18T09:30:00-04:00", network: "NFL Network" },
  { id: "2026-w6-chi-atl", week: 6, away: "CHI", home: "ATL", kickoff: "2026-10-18T13:00:00-04:00", network: "FOX" },
  { id: "2026-w6-bal-cle", week: 6, away: "BAL", home: "CLE", kickoff: "2026-10-18T13:00:00-04:00", network: "FOX" },
  { id: "2026-w6-ten-ind", week: 6, away: "TEN", home: "IND", kickoff: "2026-10-18T13:00:00-04:00", network: "FOX" },
  { id: "2026-w6-nyj-ne", week: 6, away: "NYJ", home: "NE", kickoff: "2026-10-18T13:00:00-04:00", network: "CBS" },
  { id: "2026-w6-no-nyg", week: 6, away: "NO", home: "NYG", kickoff: "2026-10-18T13:00:00-04:00", network: "FOX" },
  { id: "2026-w6-car-phi", week: 6, away: "CAR", home: "PHI", kickoff: "2026-10-18T13:00:00-04:00", network: "CBS" },
  { id: "2026-w6-pit-tb", week: 6, away: "PIT", home: "TB", kickoff: "2026-10-18T13:00:00-04:00", network: "CBS" },
  { id: "2026-w6-ari-lar", week: 6, away: "ARI", home: "LAR", kickoff: "2026-10-18T16:05:00-04:00", network: "FOX" },
  { id: "2026-w6-lac-kc", week: 6, away: "LAC", home: "KC", kickoff: "2026-10-18T16:25:00-04:00", network: "CBS" },
  { id: "2026-w6-buf-lv", week: 6, away: "BUF", home: "LV", kickoff: "2026-10-18T16:25:00-04:00", network: "CBS" },
  { id: "2026-w6-dal-gb", week: 6, away: "DAL", home: "GB", kickoff: "2026-10-18T20:20:00-04:00", network: "NBC" },
  { id: "2026-w6-was-sf", week: 6, away: "WAS", home: "SF", kickoff: "2026-10-19T20:15:00-04:00", network: "ESPN" },
];

export const WEEK_7_GAMES: Game[] = [
  { id: "2026-w7-ne-chi", week: 7, away: "NE", home: "CHI", kickoff: "2026-10-22T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w7-pit-no", week: 7, away: "PIT", home: "NO", kickoff: "2026-10-25T09:30:00-04:00", network: "NFL Network" },
  { id: "2026-w7-sf-atl", week: 7, away: "SF", home: "ATL", kickoff: "2026-10-25T13:00:00-04:00", network: "FOX" },
  { id: "2026-w7-cin-bal", week: 7, away: "CIN", home: "BAL", kickoff: "2026-10-25T13:00:00-04:00", network: "CBS" },
  { id: "2026-w7-tb-car", week: 7, away: "TB", home: "CAR", kickoff: "2026-10-25T13:00:00-04:00", network: "FOX" },
  { id: "2026-w7-nyg-hou", week: 7, away: "NYG", home: "HOU", kickoff: "2026-10-25T13:00:00-04:00", network: "FOX" },
  { id: "2026-w7-ind-min", week: 7, away: "IND", home: "MIN", kickoff: "2026-10-25T13:00:00-04:00", network: "CBS" },
  { id: "2026-w7-mia-nyj", week: 7, away: "MIA", home: "NYJ", kickoff: "2026-10-25T13:00:00-04:00", network: "CBS" },
  { id: "2026-w7-cle-ten", week: 7, away: "CLE", home: "TEN", kickoff: "2026-10-25T13:00:00-04:00", network: "CBS" },
  { id: "2026-w7-den-ari", week: 7, away: "DEN", home: "ARI", kickoff: "2026-10-25T16:05:00-04:00", network: "CBS" },
  { id: "2026-w7-gb-det", week: 7, away: "GB", home: "DET", kickoff: "2026-10-25T16:25:00-04:00", network: "FOX" },
  { id: "2026-w7-lar-lv", week: 7, away: "LAR", home: "LV", kickoff: "2026-10-25T16:25:00-04:00", network: "FOX" },
  { id: "2026-w7-kc-sea", week: 7, away: "KC", home: "SEA", kickoff: "2026-10-25T20:20:00-04:00", network: "NBC" },
  { id: "2026-w7-dal-phi", week: 7, away: "DAL", home: "PHI", kickoff: "2026-10-26T20:15:00-04:00", network: "ESPN" },
];

export const WEEK_8_GAMES: Game[] = [
  { id: "2026-w8-car-gb", week: 8, away: "CAR", home: "GB", kickoff: "2026-10-29T20:15:00-04:00", network: "Prime Video" },
  { id: "2026-w8-bal-buf", week: 8, away: "BAL", home: "BUF", kickoff: "2026-11-01T13:00:00-05:00", network: "CBS" },
  { id: "2026-w8-ten-cin", week: 8, away: "TEN", home: "CIN", kickoff: "2026-11-01T13:00:00-05:00", network: "CBS" },
  { id: "2026-w8-ari-dal", week: 8, away: "ARI", home: "DAL", kickoff: "2026-11-01T13:00:00-05:00", network: "FOX" },
  { id: "2026-w8-min-det", week: 8, away: "MIN", home: "DET", kickoff: "2026-11-01T13:00:00-05:00", network: "FOX" },
  { id: "2026-w8-ind-jax", week: 8, away: "IND", home: "JAX", kickoff: "2026-11-01T13:00:00-05:00", network: "CBS" },
  { id: "2026-w8-lv-nyj", week: 8, away: "LV", home: "NYJ", kickoff: "2026-11-01T13:00:00-05:00", network: "FOX" },
  { id: "2026-w8-cle-pit", week: 8, away: "CLE", home: "PIT", kickoff: "2026-11-01T13:00:00-05:00", network: "CBS" },
  { id: "2026-w8-atl-tb", week: 8, away: "ATL", home: "TB", kickoff: "2026-11-01T13:00:00-05:00", network: "FOX" },
  { id: "2026-w8-lac-lar", week: 8, away: "LAC", home: "LAR", kickoff: "2026-11-01T16:05:00-05:00", network: "FOX" },
  { id: "2026-w8-kc-den", week: 8, away: "KC", home: "DEN", kickoff: "2026-11-01T16:25:00-05:00", network: "CBS" },
  { id: "2026-w8-ne-mia", week: 8, away: "NE", home: "MIA", kickoff: "2026-11-01T16:25:00-05:00", network: "CBS" },
  { id: "2026-w8-phi-was", week: 8, away: "PHI", home: "WAS", kickoff: "2026-11-01T20:20:00-05:00", network: "NBC" },
  { id: "2026-w8-chi-sea", week: 8, away: "CHI", home: "SEA", kickoff: "2026-11-02T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_9_GAMES: Game[] = [
  { id: "2026-w9-jax-bal", week: 9, away: "JAX", home: "BAL", kickoff: "2026-11-05T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w9-cin-atl", week: 9, away: "CIN", home: "ATL", kickoff: "2026-11-08T09:30:00-05:00", network: "NFL Network" },
  { id: "2026-w9-den-car", week: 9, away: "DEN", home: "CAR", kickoff: "2026-11-08T13:00:00-05:00", network: "CBS" },
  { id: "2026-w9-dal-ind", week: 9, away: "DAL", home: "IND", kickoff: "2026-11-08T13:00:00-05:00", network: "FOX" },
  { id: "2026-w9-nyj-kc", week: 9, away: "NYJ", home: "KC", kickoff: "2026-11-08T13:00:00-05:00", network: "CBS" },
  { id: "2026-w9-det-mia", week: 9, away: "DET", home: "MIA", kickoff: "2026-11-08T13:00:00-05:00", network: "FOX" },
  { id: "2026-w9-cle-no", week: 9, away: "CLE", home: "NO", kickoff: "2026-11-08T13:00:00-05:00", network: "CBS" },
  { id: "2026-w9-nyg-phi", week: 9, away: "NYG", home: "PHI", kickoff: "2026-11-08T13:00:00-05:00", network: "FOX" },
  { id: "2026-w9-lar-was", week: 9, away: "LAR", home: "WAS", kickoff: "2026-11-08T13:00:00-05:00", network: "FOX" },
  { id: "2026-w9-hou-lac", week: 9, away: "HOU", home: "LAC", kickoff: "2026-11-08T16:05:00-05:00", network: "CBS" },
  { id: "2026-w9-lv-sf", week: 9, away: "LV", home: "SF", kickoff: "2026-11-08T16:05:00-05:00", network: "CBS" },
  { id: "2026-w9-gb-ne", week: 9, away: "GB", home: "NE", kickoff: "2026-11-08T16:25:00-05:00", network: "FOX" },
  { id: "2026-w9-ari-sea", week: 9, away: "ARI", home: "SEA", kickoff: "2026-11-08T16:25:00-05:00", network: "FOX" },
  { id: "2026-w9-tb-chi", week: 9, away: "TB", home: "CHI", kickoff: "2026-11-08T20:20:00-05:00", network: "NBC" },
  { id: "2026-w9-buf-min", week: 9, away: "BUF", home: "MIN", kickoff: "2026-11-09T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_10_GAMES: Game[] = [
  { id: "2026-w10-was-nyg", week: 10, away: "WAS", home: "NYG", kickoff: "2026-11-12T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w10-ne-det", week: 10, away: "NE", home: "DET", kickoff: "2026-11-15T09:30:00-05:00", network: "FOX" },
  { id: "2026-w10-kc-atl", week: 10, away: "KC", home: "ATL", kickoff: "2026-11-15T13:00:00-05:00", network: "CBS" },
  { id: "2026-w10-hou-cle", week: 10, away: "HOU", home: "CLE", kickoff: "2026-11-15T13:00:00-05:00", network: "FOX" },
  { id: "2026-w10-min-gb", week: 10, away: "MIN", home: "GB", kickoff: "2026-11-15T13:00:00-05:00", network: "FOX" },
  { id: "2026-w10-mia-ind", week: 10, away: "MIA", home: "IND", kickoff: "2026-11-15T13:00:00-05:00", network: "CBS" },
  { id: "2026-w10-car-no", week: 10, away: "CAR", home: "NO", kickoff: "2026-11-15T13:00:00-05:00", network: "FOX" },
  { id: "2026-w10-buf-nyj", week: 10, away: "BUF", home: "NYJ", kickoff: "2026-11-15T13:00:00-05:00", network: "CBS" },
  { id: "2026-w10-jax-ten", week: 10, away: "JAX", home: "TEN", kickoff: "2026-11-15T13:00:00-05:00", network: "FOX" },
  { id: "2026-w10-lar-ari", week: 10, away: "LAR", home: "ARI", kickoff: "2026-11-15T16:05:00-05:00", network: "CBS" },
  { id: "2026-w10-sea-lv", week: 10, away: "SEA", home: "LV", kickoff: "2026-11-15T16:05:00-05:00", network: "CBS" },
  { id: "2026-w10-sf-dal", week: 10, away: "SF", home: "DAL", kickoff: "2026-11-15T16:25:00-05:00", network: "FOX" },
  { id: "2026-w10-pit-cin", week: 10, away: "PIT", home: "CIN", kickoff: "2026-11-15T20:20:00-05:00", network: "NBC" },
  { id: "2026-w10-lac-bal", week: 10, away: "LAC", home: "BAL", kickoff: "2026-11-16T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_11_GAMES: Game[] = [
  { id: "2026-w11-ind-hou", week: 11, away: "IND", home: "HOU", kickoff: "2026-11-19T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w11-mia-buf", week: 11, away: "MIA", home: "BUF", kickoff: "2026-11-22T13:00:00-05:00", network: "FOX" },
  { id: "2026-w11-bal-car", week: 11, away: "BAL", home: "CAR", kickoff: "2026-11-22T13:00:00-05:00", network: "FOX" },
  { id: "2026-w11-no-chi", week: 11, away: "NO", home: "CHI", kickoff: "2026-11-22T13:00:00-05:00", network: "FOX" },
  { id: "2026-w11-ten-dal", week: 11, away: "TEN", home: "DAL", kickoff: "2026-11-22T13:00:00-05:00", network: "FOX" },
  { id: "2026-w11-tb-det", week: 11, away: "TB", home: "DET", kickoff: "2026-11-22T13:00:00-05:00", network: "CBS" },
  { id: "2026-w11-ari-kc", week: 11, away: "ARI", home: "KC", kickoff: "2026-11-22T13:00:00-05:00", network: "CBS" },
  { id: "2026-w11-jax-nyg", week: 11, away: "JAX", home: "NYG", kickoff: "2026-11-22T13:00:00-05:00", network: "CBS" },
  { id: "2026-w11-nyj-lac", week: 11, away: "NYJ", home: "LAC", kickoff: "2026-11-22T16:05:00-05:00", network: "FOX" },
  { id: "2026-w11-lv-den", week: 11, away: "LV", home: "DEN", kickoff: "2026-11-22T16:25:00-05:00", network: "CBS" },
  { id: "2026-w11-pit-phi", week: 11, away: "PIT", home: "PHI", kickoff: "2026-11-22T16:25:00-05:00", network: "CBS" },
  { id: "2026-w11-min-sf", week: 11, away: "MIN", home: "SF", kickoff: "2026-11-22T20:20:00-05:00", network: "NBC" },
  { id: "2026-w11-cin-was", week: 11, away: "CIN", home: "WAS", kickoff: "2026-11-23T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_12_GAMES: Game[] = [
  { id: "2026-w12-gb-lar", week: 12, away: "GB", home: "LAR", kickoff: "2026-11-25T20:00:00-05:00", network: "Netflix" },
  { id: "2026-w12-chi-det", week: 12, away: "CHI", home: "DET", kickoff: "2026-11-26T13:00:00-05:00", network: "CBS" },
  { id: "2026-w12-phi-dal", week: 12, away: "PHI", home: "DAL", kickoff: "2026-11-26T16:30:00-05:00", network: "FOX" },
  { id: "2026-w12-kc-buf", week: 12, away: "KC", home: "BUF", kickoff: "2026-11-26T20:20:00-05:00", network: "NBC" },
  { id: "2026-w12-den-pit", week: 12, away: "DEN", home: "PIT", kickoff: "2026-11-27T15:00:00-05:00", network: "Prime Video" },
  { id: "2026-w12-no-cin", week: 12, away: "NO", home: "CIN", kickoff: "2026-11-29T13:00:00-05:00", network: "CBS" },
  { id: "2026-w12-lv-cle", week: 12, away: "LV", home: "CLE", kickoff: "2026-11-29T13:00:00-05:00", network: "FOX" },
  { id: "2026-w12-bal-hou", week: 12, away: "BAL", home: "HOU", kickoff: "2026-11-29T13:00:00-05:00", network: "CBS" },
  { id: "2026-w12-nyg-ind", week: 12, away: "NYG", home: "IND", kickoff: "2026-11-29T13:00:00-05:00", network: "FOX" },
  { id: "2026-w12-nyj-mia", week: 12, away: "NYJ", home: "MIA", kickoff: "2026-11-29T13:00:00-05:00", network: "CBS" },
  { id: "2026-w12-atl-min", week: 12, away: "ATL", home: "MIN", kickoff: "2026-11-29T13:00:00-05:00", network: "FOX" },
  { id: "2026-w12-ten-jax", week: 12, away: "TEN", home: "JAX", kickoff: "2026-11-29T16:05:00-05:00", network: "CBS" },
  { id: "2026-w12-was-ari", week: 12, away: "WAS", home: "ARI", kickoff: "2026-11-29T16:25:00-05:00", network: "FOX" },
  { id: "2026-w12-sea-sf", week: 12, away: "SEA", home: "SF", kickoff: "2026-11-29T16:25:00-05:00", network: "FOX" },
  { id: "2026-w12-ne-lac", week: 12, away: "NE", home: "LAC", kickoff: "2026-11-29T20:20:00-05:00", network: "NBC" },
  { id: "2026-w12-car-tb", week: 12, away: "CAR", home: "TB", kickoff: "2026-11-30T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_13_GAMES: Game[] = [
  { id: "2026-w13-kc-lar", week: 13, away: "KC", home: "LAR", kickoff: "2026-12-03T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w13-det-atl", week: 13, away: "DET", home: "ATL", kickoff: "2026-12-06T13:00:00-05:00", network: "CBS" },
  { id: "2026-w13-jax-chi", week: 13, away: "JAX", home: "CHI", kickoff: "2026-12-06T13:00:00-05:00", network: "FOX" },
  { id: "2026-w13-cin-cle", week: 13, away: "CIN", home: "CLE", kickoff: "2026-12-06T13:00:00-05:00", network: "CBS" },
  { id: "2026-w13-gb-no", week: 13, away: "GB", home: "NO", kickoff: "2026-12-06T13:00:00-05:00", network: "FOX" },
  { id: "2026-w13-sf-nyg", week: 13, away: "SF", home: "NYG", kickoff: "2026-12-06T13:00:00-05:00", network: "FOX" },
  { id: "2026-w13-lac-tb", week: 13, away: "LAC", home: "TB", kickoff: "2026-12-06T13:00:00-05:00", network: "CBS" },
  { id: "2026-w13-was-ten", week: 13, away: "WAS", home: "TEN", kickoff: "2026-12-06T13:00:00-05:00", network: "CBS" },
  { id: "2026-w13-phi-ari", week: 13, away: "PHI", home: "ARI", kickoff: "2026-12-06T16:05:00-05:00", network: "FOX" },
  { id: "2026-w13-mia-den", week: 13, away: "MIA", home: "DEN", kickoff: "2026-12-06T16:05:00-05:00", network: "FOX" },
  { id: "2026-w13-car-min", week: 13, away: "CAR", home: "MIN", kickoff: "2026-12-06T16:25:00-05:00", network: "CBS" },
  { id: "2026-w13-buf-ne", week: 13, away: "BUF", home: "NE", kickoff: "2026-12-06T16:25:00-05:00", network: "CBS" },
  { id: "2026-w13-hou-pit", week: 13, away: "HOU", home: "PIT", kickoff: "2026-12-06T20:20:00-05:00", network: "NBC" },
  { id: "2026-w13-dal-sea", week: 13, away: "DAL", home: "SEA", kickoff: "2026-12-07T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_14_GAMES: Game[] = [
  { id: "2026-w14-min-ne", week: 14, away: "MIN", home: "NE", kickoff: "2026-12-10T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w14-tb-bal", week: 14, away: "TB", home: "BAL", kickoff: "2026-12-13T13:00:00-05:00", network: "FOX" },
  { id: "2026-w14-no-car", week: 14, away: "NO", home: "CAR", kickoff: "2026-12-13T13:00:00-05:00", network: "CBS" },
  { id: "2026-w14-atl-cle", week: 14, away: "ATL", home: "CLE", kickoff: "2026-12-13T13:00:00-05:00", network: "CBS" },
  { id: "2026-w14-ten-det", week: 14, away: "TEN", home: "DET", kickoff: "2026-12-13T13:00:00-05:00", network: "FOX" },
  { id: "2026-w14-chi-mia", week: 14, away: "CHI", home: "MIA", kickoff: "2026-12-13T13:00:00-05:00", network: "CBS" },
  { id: "2026-w14-den-nyj", week: 14, away: "DEN", home: "NYJ", kickoff: "2026-12-13T13:00:00-05:00", network: "CBS" },
  { id: "2026-w14-ind-phi", week: 14, away: "IND", home: "PHI", kickoff: "2026-12-13T13:00:00-05:00", network: "FOX" },
  { id: "2026-w14-hou-was", week: 14, away: "HOU", home: "WAS", kickoff: "2026-12-13T13:00:00-05:00", network: "CBS" },
  { id: "2026-w14-lac-lv", week: 14, away: "LAC", home: "LV", kickoff: "2026-12-13T16:05:00-05:00", network: "CBS" },
  { id: "2026-w14-kc-cin", week: 14, away: "KC", home: "CIN", kickoff: "2026-12-13T16:25:00-05:00", network: "FOX" },
  { id: "2026-w14-nyg-sea", week: 14, away: "NYG", home: "SEA", kickoff: "2026-12-13T16:25:00-05:00", network: "FOX" },
  { id: "2026-w14-lar-sf", week: 14, away: "LAR", home: "SF", kickoff: "2026-12-13T16:25:00-05:00", network: "FOX" },
  { id: "2026-w14-buf-gb", week: 14, away: "BUF", home: "GB", kickoff: "2026-12-13T20:20:00-05:00", network: "NBC" },
  { id: "2026-w14-pit-jax", week: 14, away: "PIT", home: "JAX", kickoff: "2026-12-14T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_15_GAMES: Game[] = [
  { id: "2026-w15-sf-lac", week: 15, away: "SF", home: "LAC", kickoff: "2026-12-17T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w15-sea-phi", week: 15, away: "SEA", home: "PHI", kickoff: "2026-12-19T17:00:00-05:00", network: "FOX" },
  { id: "2026-w15-chi-buf", week: 15, away: "CHI", home: "BUF", kickoff: "2026-12-19T20:20:00-05:00", network: "CBS" },
  { id: "2026-w15-cin-car", week: 15, away: "CIN", home: "CAR", kickoff: "2026-12-20T13:00:00-05:00", network: "FOX" },
  { id: "2026-w15-mia-gb", week: 15, away: "MIA", home: "GB", kickoff: "2026-12-20T13:00:00-05:00", network: "FOX" },
  { id: "2026-w15-jax-hou", week: 15, away: "JAX", home: "HOU", kickoff: "2026-12-20T13:00:00-05:00", network: "CBS" },
  { id: "2026-w15-cle-nyg", week: 15, away: "CLE", home: "NYG", kickoff: "2026-12-20T13:00:00-05:00", network: "CBS" },
  { id: "2026-w15-bal-pit", week: 15, away: "BAL", home: "PIT", kickoff: "2026-12-20T13:00:00-05:00", network: "CBS" },
  { id: "2026-w15-no-tb", week: 15, away: "NO", home: "TB", kickoff: "2026-12-20T13:00:00-05:00", network: "FOX" },
  { id: "2026-w15-ind-ten", week: 15, away: "IND", home: "TEN", kickoff: "2026-12-20T13:00:00-05:00", network: "CBS" },
  { id: "2026-w15-atl-was", week: 15, away: "ATL", home: "WAS", kickoff: "2026-12-20T13:00:00-05:00", network: "FOX" },
  { id: "2026-w15-nyj-ari", week: 15, away: "NYJ", home: "ARI", kickoff: "2026-12-20T16:05:00-05:00", network: "FOX" },
  { id: "2026-w15-dal-lar", week: 15, away: "DAL", home: "LAR", kickoff: "2026-12-20T16:25:00-05:00", network: "CBS" },
  { id: "2026-w15-den-lv", week: 15, away: "DEN", home: "LV", kickoff: "2026-12-20T16:25:00-05:00", network: "CBS" },
  { id: "2026-w15-det-min", week: 15, away: "DET", home: "MIN", kickoff: "2026-12-20T20:20:00-05:00", network: "NBC" },
  { id: "2026-w15-ne-kc", week: 15, away: "NE", home: "KC", kickoff: "2026-12-21T20:15:00-05:00", network: "ESPN" },
];

export const WEEK_16_GAMES: Game[] = [
  { id: "2026-w16-hou-phi", week: 16, away: "HOU", home: "PHI", kickoff: "2026-12-24T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w16-gb-chi", week: 16, away: "GB", home: "CHI", kickoff: "2026-12-25T13:00:00-05:00", network: "Netflix" },
  { id: "2026-w16-buf-den", week: 16, away: "BUF", home: "DEN", kickoff: "2026-12-25T16:30:00-05:00", network: "Netflix" },
  { id: "2026-w16-lar-sea", week: 16, away: "LAR", home: "SEA", kickoff: "2026-12-25T20:15:00-05:00", network: "FOX" },
  { id: "2026-w16-cle-bal", week: 16, away: "CLE", home: "BAL", kickoff: "2026-12-27T13:00:00-05:00", network: "CBS" },
  { id: "2026-w16-lac-mia", week: 16, away: "LAC", home: "MIA", kickoff: "2026-12-27T13:00:00-05:00", network: "FOX" },
  { id: "2026-w16-ari-no", week: 16, away: "ARI", home: "NO", kickoff: "2026-12-27T13:00:00-05:00", network: "FOX" },
  { id: "2026-w16-ne-nyj", week: 16, away: "NE", home: "NYJ", kickoff: "2026-12-27T13:00:00-05:00", network: "CBS" },
  { id: "2026-w16-ten-lv", week: 16, away: "TEN", home: "LV", kickoff: "2026-12-27T16:05:00-05:00", network: "FOX" },
  { id: "2026-w16-sf-kc", week: 16, away: "SF", home: "KC", kickoff: "2026-12-27T16:25:00-05:00", network: "CBS" },
  { id: "2026-w16-jax-dal", week: 16, away: "JAX", home: "DAL", kickoff: "2026-12-27T20:20:00-05:00", network: "NBC" },
  { id: "2026-w16-nyg-det", week: 16, away: "NYG", home: "DET", kickoff: "2026-12-28T20:15:00-05:00", network: "ESPN" },
  { id: "2026-w16-tb-atl", week: 16, away: "TB", home: "ATL", kickoff: "2026-12-27T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w16-cin-ind", week: 16, away: "CIN", home: "IND", kickoff: "2026-12-27T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w16-was-min", week: 16, away: "WAS", home: "MIN", kickoff: "2026-12-27T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w16-car-pit", week: 16, away: "CAR", home: "PIT", kickoff: "2026-12-27T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
];

export const WEEK_17_GAMES: Game[] = [
  { id: "2026-w17-bal-cin", week: 17, away: "BAL", home: "CIN", kickoff: "2026-12-31T20:15:00-05:00", network: "Prime Video" },
  { id: "2026-w17-no-atl", week: 17, away: "NO", home: "ATL", kickoff: "2027-01-03T13:00:00-05:00", network: "FOX" },
  { id: "2026-w17-sea-car", week: 17, away: "SEA", home: "CAR", kickoff: "2027-01-03T13:00:00-05:00", network: "FOX" },
  { id: "2026-w17-ind-cle", week: 17, away: "IND", home: "CLE", kickoff: "2027-01-03T13:00:00-05:00", network: "FOX" },
  { id: "2026-w17-nyg-dal", week: 17, away: "NYG", home: "DAL", kickoff: "2027-01-03T13:00:00-05:00", network: "FOX" },
  { id: "2026-w17-buf-mia", week: 17, away: "BUF", home: "MIA", kickoff: "2027-01-03T13:00:00-05:00", network: "CBS" },
  { id: "2026-w17-min-nyj", week: 17, away: "MIN", home: "NYJ", kickoff: "2027-01-03T13:00:00-05:00", network: "CBS" },
  { id: "2026-w17-pit-ten", week: 17, away: "PIT", home: "TEN", kickoff: "2027-01-03T13:00:00-05:00", network: "CBS" },
  { id: "2026-w17-lv-ari", week: 17, away: "LV", home: "ARI", kickoff: "2027-01-03T16:05:00-05:00", network: "CBS" },
  { id: "2026-w17-det-chi", week: 17, away: "DET", home: "CHI", kickoff: "2027-01-03T16:25:00-05:00", network: "FOX" },
  { id: "2026-w17-phi-sf", week: 17, away: "PHI", home: "SF", kickoff: "2027-01-03T20:20:00-05:00", network: "NBC" },
  { id: "2026-w17-hou-gb", week: 17, away: "HOU", home: "GB", kickoff: "2027-01-04T20:15:00-05:00", network: "ESPN" },
  { id: "2026-w17-was-jax", week: 17, away: "WAS", home: "JAX", kickoff: "2027-01-03T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w17-kc-lac", week: 17, away: "KC", home: "LAC", kickoff: "2027-01-03T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w17-den-ne", week: 17, away: "DEN", home: "NE", kickoff: "2027-01-03T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w17-lar-tb", week: 17, away: "LAR", home: "TB", kickoff: "2027-01-03T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
];

export const WEEK_18_GAMES: Game[] = [
  { id: "2026-w18-sf-ari", week: 18, away: "SF", home: "ARI", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-pit-bal", week: 18, away: "PIT", home: "BAL", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-nyj-buf", week: 18, away: "NYJ", home: "BUF", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-atl-car", week: 18, away: "ATL", home: "CAR", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-cle-cin", week: 18, away: "CLE", home: "CIN", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-lac-den", week: 18, away: "LAC", home: "DEN", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-det-gb", week: 18, away: "DET", home: "GB", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-ten-hou", week: 18, away: "TEN", home: "HOU", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-jax-ind", week: 18, away: "JAX", home: "IND", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-lv-kc", week: 18, away: "LV", home: "KC", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-sea-lar", week: 18, away: "SEA", home: "LAR", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-chi-min", week: 18, away: "CHI", home: "MIN", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-mia-ne", week: 18, away: "MIA", home: "NE", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-tb-no", week: 18, away: "TB", home: "NO", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-phi-nyg", week: 18, away: "PHI", home: "NYG", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
  { id: "2026-w18-dal-was", week: 18, away: "DAL", home: "WAS", kickoff: "2027-01-10T13:00:00-05:00", network: "TBD" },  // TBD - confirm date/time/network closer to the week
];

// To add a new week: copy any WEEK_N_GAMES array above, fill in real
// matchups/spreads, register it below, and bump CURRENT_WEEK. Team
// colors/logos in teams.ts don't need to change - every team abbreviation
// already resolves there.
//
// Weeks 2-18 below are prefilled with the real 2026 matchups (source:
// nfl.com/schedules), but every game's favorite/spread is still unset -
// fill those in the week before it goes live. Games marked TBD (the
// handful of flexed/international slots the league hadn't locked in at
// the time this was written, plus all of Week 18) need their real
// date/time/network confirmed closer to kickoff too.
export const GAMES_BY_WEEK: Record<number, Game[]> = {
  1: WEEK_1_GAMES,
  2: WEEK_2_GAMES,
  3: WEEK_3_GAMES,
  4: WEEK_4_GAMES,
  5: WEEK_5_GAMES,
  6: WEEK_6_GAMES,
  7: WEEK_7_GAMES,
  8: WEEK_8_GAMES,
  9: WEEK_9_GAMES,
  10: WEEK_10_GAMES,
  11: WEEK_11_GAMES,
  12: WEEK_12_GAMES,
  13: WEEK_13_GAMES,
  14: WEEK_14_GAMES,
  15: WEEK_15_GAMES,
  16: WEEK_16_GAMES,
  17: WEEK_17_GAMES,
  18: WEEK_18_GAMES,
};

// Only this week's games render anywhere in the app - bump this each
// week (and fill in that week's spreads) to advance the season. Weeks
// after this one are effectively hidden simply by never being read.
export const CURRENT_WEEK = 1;
