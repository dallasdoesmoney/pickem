export type TeamAbbr =
  | "ARI" | "ATL" | "BAL" | "BUF" | "CAR" | "CHI" | "CIN" | "CLE"
  | "DAL" | "DEN" | "DET" | "GB" | "HOU" | "IND" | "JAX" | "KC"
  | "LAC" | "LAR" | "LV" | "MIA" | "MIN" | "NE" | "NO" | "NYG"
  | "NYJ" | "PHI" | "PIT" | "SEA" | "SF" | "TB" | "TEN" | "WAS";

export type Team = {
  abbr: TeamAbbr;
  name: string;
  color: string;
  logo: string;
};

function espnLogo(espnAbbr: string) {
  return `https://a.espncdn.com/i/teamlogos/nfl/500/${espnAbbr}.png`;
}

export const TEAMS: Record<TeamAbbr, Team> = {
  ARI: { abbr: "ARI", name: "Cardinals", color: "#97233F", logo: espnLogo("ari") },
  ATL: { abbr: "ATL", name: "Falcons", color: "#A71930", logo: espnLogo("atl") },
  BAL: { abbr: "BAL", name: "Ravens", color: "#241773", logo: espnLogo("bal") },
  BUF: { abbr: "BUF", name: "Bills", color: "#00338D", logo: espnLogo("buf") },
  CAR: { abbr: "CAR", name: "Panthers", color: "#0085CA", logo: espnLogo("car") },
  CHI: { abbr: "CHI", name: "Bears", color: "#0B162A", logo: espnLogo("chi") },
  CIN: { abbr: "CIN", name: "Bengals", color: "#FB4F14", logo: espnLogo("cin") },
  CLE: { abbr: "CLE", name: "Browns", color: "#311D00", logo: espnLogo("cle") },
  DAL: { abbr: "DAL", name: "Cowboys", color: "#003594", logo: espnLogo("dal") },
  DEN: { abbr: "DEN", name: "Broncos", color: "#FB4F14", logo: espnLogo("den") },
  DET: { abbr: "DET", name: "Lions", color: "#0076B6", logo: espnLogo("det") },
  GB: { abbr: "GB", name: "Packers", color: "#203731", logo: espnLogo("gb") },
  HOU: { abbr: "HOU", name: "Texans", color: "#03202F", logo: espnLogo("hou") },
  IND: { abbr: "IND", name: "Colts", color: "#002C5F", logo: espnLogo("ind") },
  JAX: { abbr: "JAX", name: "Jaguars", color: "#101820", logo: espnLogo("jax") },
  KC: { abbr: "KC", name: "Chiefs", color: "#E31837", logo: espnLogo("kc") },
  LAC: { abbr: "LAC", name: "Chargers", color: "#0080C6", logo: espnLogo("lac") },
  LAR: { abbr: "LAR", name: "Rams", color: "#003594", logo: espnLogo("lar") },
  LV: { abbr: "LV", name: "Raiders", color: "#000000", logo: espnLogo("lv") },
  MIA: { abbr: "MIA", name: "Dolphins", color: "#008E97", logo: espnLogo("mia") },
  MIN: { abbr: "MIN", name: "Vikings", color: "#4F2683", logo: espnLogo("min") },
  NE: { abbr: "NE", name: "Patriots", color: "#002244", logo: espnLogo("ne") },
  NO: { abbr: "NO", name: "Saints", color: "#D3BC8D", logo: espnLogo("no") },
  NYG: { abbr: "NYG", name: "Giants", color: "#0B2265", logo: espnLogo("nyg") },
  NYJ: { abbr: "NYJ", name: "Jets", color: "#125740", logo: espnLogo("nyj") },
  PHI: { abbr: "PHI", name: "Eagles", color: "#004C54", logo: espnLogo("phi") },
  PIT: { abbr: "PIT", name: "Steelers", color: "#FFB612", logo: espnLogo("pit") },
  SEA: { abbr: "SEA", name: "Seahawks", color: "#002244", logo: espnLogo("sea") },
  SF: { abbr: "SF", name: "49ers", color: "#AA0000", logo: espnLogo("sf") },
  TB: { abbr: "TB", name: "Buccaneers", color: "#D50A0A", logo: espnLogo("tb") },
  TEN: { abbr: "TEN", name: "Titans", color: "#4B92DB", logo: espnLogo("ten") },
  WAS: { abbr: "WAS", name: "Commanders", color: "#5A1414", logo: espnLogo("wsh") },
};
