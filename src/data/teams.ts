export type TeamAbbr =
  | "ARI" | "ATL" | "BAL" | "BUF" | "CAR" | "CHI" | "CIN" | "CLE"
  | "DAL" | "DEN" | "DET" | "GB" | "HOU" | "IND" | "JAX" | "KC"
  | "LAC" | "LAR" | "LV" | "MIA" | "MIN" | "NE" | "NO" | "NYG"
  | "NYJ" | "PHI" | "PIT" | "SEA" | "SF" | "TB" | "TEN" | "WAS";

export type Team = {
  abbr: TeamAbbr;
  city: string;
  name: string;
  color: string;
  logo: string;
};

function espnLogo(espnAbbr: string) {
  // "500-dark" variant has outlined marks built for colored/dark backgrounds,
  // so logos stay legible even when a team's own color is used behind them.
  return `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${espnAbbr}.png`;
}

export const TEAMS: Record<TeamAbbr, Team> = {
  ARI: { abbr: "ARI", city: "Arizona", name: "Cardinals", color: "#97233F", logo: espnLogo("ari") },
  ATL: { abbr: "ATL", city: "Atlanta", name: "Falcons", color: "#A71930", logo: espnLogo("atl") },
  BAL: { abbr: "BAL", city: "Baltimore", name: "Ravens", color: "#241773", logo: espnLogo("bal") },
  BUF: { abbr: "BUF", city: "Buffalo", name: "Bills", color: "#00338D", logo: espnLogo("buf") },
  CAR: { abbr: "CAR", city: "Carolina", name: "Panthers", color: "#0085CA", logo: espnLogo("car") },
  CHI: { abbr: "CHI", city: "Chicago", name: "Bears", color: "#0B162A", logo: espnLogo("chi") },
  CIN: { abbr: "CIN", city: "Cincinnati", name: "Bengals", color: "#FB4F14", logo: espnLogo("cin") },
  CLE: { abbr: "CLE", city: "Cleveland", name: "Browns", color: "#311D00", logo: espnLogo("cle") },
  DAL: { abbr: "DAL", city: "Dallas", name: "Cowboys", color: "#003594", logo: espnLogo("dal") },
  DEN: { abbr: "DEN", city: "Denver", name: "Broncos", color: "#FB4F14", logo: espnLogo("den") },
  DET: { abbr: "DET", city: "Detroit", name: "Lions", color: "#0076B6", logo: espnLogo("det") },
  GB: { abbr: "GB", city: "Green Bay", name: "Packers", color: "#203731", logo: espnLogo("gb") },
  HOU: { abbr: "HOU", city: "Houston", name: "Texans", color: "#03202F", logo: espnLogo("hou") },
  IND: { abbr: "IND", city: "Indianapolis", name: "Colts", color: "#002C5F", logo: espnLogo("ind") },
  JAX: { abbr: "JAX", city: "Jacksonville", name: "Jaguars", color: "#101820", logo: espnLogo("jax") },
  KC: { abbr: "KC", city: "Kansas City", name: "Chiefs", color: "#E31837", logo: espnLogo("kc") },
  LAC: { abbr: "LAC", city: "Los Angeles", name: "Chargers", color: "#0080C6", logo: espnLogo("lac") },
  LAR: { abbr: "LAR", city: "Los Angeles", name: "Rams", color: "#003594", logo: espnLogo("lar") },
  LV: { abbr: "LV", city: "Las Vegas", name: "Raiders", color: "#000000", logo: espnLogo("lv") },
  MIA: { abbr: "MIA", city: "Miami", name: "Dolphins", color: "#008E97", logo: espnLogo("mia") },
  MIN: { abbr: "MIN", city: "Minnesota", name: "Vikings", color: "#4F2683", logo: espnLogo("min") },
  NE: { abbr: "NE", city: "New England", name: "Patriots", color: "#002244", logo: espnLogo("ne") },
  NO: { abbr: "NO", city: "New Orleans", name: "Saints", color: "#D3BC8D", logo: espnLogo("no") },
  NYG: { abbr: "NYG", city: "New York", name: "Giants", color: "#0B2265", logo: espnLogo("nyg") },
  NYJ: { abbr: "NYJ", city: "New York", name: "Jets", color: "#125740", logo: espnLogo("nyj") },
  PHI: { abbr: "PHI", city: "Philadelphia", name: "Eagles", color: "#004C54", logo: espnLogo("phi") },
  PIT: { abbr: "PIT", city: "Pittsburgh", name: "Steelers", color: "#FFB612", logo: espnLogo("pit") },
  SEA: { abbr: "SEA", city: "Seattle", name: "Seahawks", color: "#002244", logo: espnLogo("sea") },
  SF: { abbr: "SF", city: "San Francisco", name: "49ers", color: "#AA0000", logo: espnLogo("sf") },
  TB: { abbr: "TB", city: "Tampa Bay", name: "Buccaneers", color: "#D50A0A", logo: espnLogo("tb") },
  TEN: { abbr: "TEN", city: "Tennessee", name: "Titans", color: "#4B92DB", logo: espnLogo("ten") },
  WAS: { abbr: "WAS", city: "Washington", name: "Commanders", color: "#5A1414", logo: espnLogo("wsh") },
};

// Alphabetical by city then name - shared by every team picker (nav
// switcher, the team-select landing page) so they can't drift apart.
export const TEAMS_SORTED: Team[] = Object.values(TEAMS).sort((a, b) => `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`));
