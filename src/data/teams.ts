export type TeamAbbr =
  | "ARI" | "ATL" | "BAL" | "BUF" | "CAR" | "CHI" | "CIN" | "CLE"
  | "DAL" | "DEN" | "DET" | "GB" | "HOU" | "IND" | "JAX" | "KC"
  | "LAC" | "LAR" | "LV" | "MIA" | "MIN" | "NE" | "NO" | "NYG"
  | "NYJ" | "PHI" | "PIT" | "SEA" | "SF" | "TB" | "TEN" | "WAS";

export type Team = {
  abbr: TeamAbbr;
  name: string;
  color: string;
};

export const TEAMS: Record<TeamAbbr, Team> = {
  ARI: { abbr: "ARI", name: "Cardinals", color: "#97233F" },
  ATL: { abbr: "ATL", name: "Falcons", color: "#A71930" },
  BAL: { abbr: "BAL", name: "Ravens", color: "#241773" },
  BUF: { abbr: "BUF", name: "Bills", color: "#00338D" },
  CAR: { abbr: "CAR", name: "Panthers", color: "#0085CA" },
  CHI: { abbr: "CHI", name: "Bears", color: "#0B162A" },
  CIN: { abbr: "CIN", name: "Bengals", color: "#FB4F14" },
  CLE: { abbr: "CLE", name: "Browns", color: "#311D00" },
  DAL: { abbr: "DAL", name: "Cowboys", color: "#003594" },
  DEN: { abbr: "DEN", name: "Broncos", color: "#FB4F14" },
  DET: { abbr: "DET", name: "Lions", color: "#0076B6" },
  GB: { abbr: "GB", name: "Packers", color: "#203731" },
  HOU: { abbr: "HOU", name: "Texans", color: "#03202F" },
  IND: { abbr: "IND", name: "Colts", color: "#002C5F" },
  JAX: { abbr: "JAX", name: "Jaguars", color: "#101820" },
  KC: { abbr: "KC", name: "Chiefs", color: "#E31837" },
  LAC: { abbr: "LAC", name: "Chargers", color: "#0080C6" },
  LAR: { abbr: "LAR", name: "Rams", color: "#003594" },
  LV: { abbr: "LV", name: "Raiders", color: "#000000" },
  MIA: { abbr: "MIA", name: "Dolphins", color: "#008E97" },
  MIN: { abbr: "MIN", name: "Vikings", color: "#4F2683" },
  NE: { abbr: "NE", name: "Patriots", color: "#002244" },
  NO: { abbr: "NO", name: "Saints", color: "#D3BC8D" },
  NYG: { abbr: "NYG", name: "Giants", color: "#0B2265" },
  NYJ: { abbr: "NYJ", name: "Jets", color: "#125740" },
  PHI: { abbr: "PHI", name: "Eagles", color: "#004C54" },
  PIT: { abbr: "PIT", name: "Steelers", color: "#FFB612" },
  SEA: { abbr: "SEA", name: "Seahawks", color: "#002244" },
  SF: { abbr: "SF", name: "49ers", color: "#AA0000" },
  TB: { abbr: "TB", name: "Buccaneers", color: "#D50A0A" },
  TEN: { abbr: "TEN", name: "Titans", color: "#4B92DB" },
  WAS: { abbr: "WAS", name: "Commanders", color: "#5A1414" },
};
