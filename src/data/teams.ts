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
  // Hint columns for the daily player puzzle, where "right division,
  // wrong team" is what a near-miss guess actually tells you. Hand
  // written rather than synced: realignment happens about once a decade,
  // and a sync that can fail is a worse source than a constant for
  // something that stable.
  conference: Conference;
  division: Division;
};

export type Conference = "AFC" | "NFC";
export type Division = "East" | "North" | "South" | "West";

function espnLogo(espnAbbr: string) {
  // "500-dark" variant has outlined marks built for colored/dark backgrounds,
  // so logos stay legible even when a team's own color is used behind them.
  return `https://a.espncdn.com/i/teamlogos/nfl/500-dark/${espnAbbr}.png`;
}

export const TEAMS: Record<TeamAbbr, Team> = {
  ARI: { abbr: "ARI", city: "Arizona", name: "Cardinals", color: "#97233F", logo: espnLogo("ari"), conference: "NFC", division: "West" },
  ATL: { abbr: "ATL", city: "Atlanta", name: "Falcons", color: "#A71930", logo: espnLogo("atl"), conference: "NFC", division: "South" },
  BAL: { abbr: "BAL", city: "Baltimore", name: "Ravens", color: "#241773", logo: espnLogo("bal"), conference: "AFC", division: "North" },
  BUF: { abbr: "BUF", city: "Buffalo", name: "Bills", color: "#00338D", logo: espnLogo("buf"), conference: "AFC", division: "East" },
  CAR: { abbr: "CAR", city: "Carolina", name: "Panthers", color: "#0085CA", logo: espnLogo("car"), conference: "NFC", division: "South" },
  CHI: { abbr: "CHI", city: "Chicago", name: "Bears", color: "#0B162A", logo: espnLogo("chi"), conference: "NFC", division: "North" },
  CIN: { abbr: "CIN", city: "Cincinnati", name: "Bengals", color: "#FB4F14", logo: espnLogo("cin"), conference: "AFC", division: "North" },
  CLE: { abbr: "CLE", city: "Cleveland", name: "Browns", color: "#311D00", logo: espnLogo("cle"), conference: "AFC", division: "North" },
  DAL: { abbr: "DAL", city: "Dallas", name: "Cowboys", color: "#003594", logo: espnLogo("dal"), conference: "NFC", division: "East" },
  DEN: { abbr: "DEN", city: "Denver", name: "Broncos", color: "#FB4F14", logo: espnLogo("den"), conference: "AFC", division: "West" },
  DET: { abbr: "DET", city: "Detroit", name: "Lions", color: "#0076B6", logo: espnLogo("det"), conference: "NFC", division: "North" },
  GB: { abbr: "GB", city: "Green Bay", name: "Packers", color: "#203731", logo: espnLogo("gb"), conference: "NFC", division: "North" },
  HOU: { abbr: "HOU", city: "Houston", name: "Texans", color: "#03202F", logo: espnLogo("hou"), conference: "AFC", division: "South" },
  IND: { abbr: "IND", city: "Indianapolis", name: "Colts", color: "#002C5F", logo: espnLogo("ind"), conference: "AFC", division: "South" },
  JAX: { abbr: "JAX", city: "Jacksonville", name: "Jaguars", color: "#101820", logo: espnLogo("jax"), conference: "AFC", division: "South" },
  KC: { abbr: "KC", city: "Kansas City", name: "Chiefs", color: "#E31837", logo: espnLogo("kc"), conference: "AFC", division: "West" },
  LAC: { abbr: "LAC", city: "Los Angeles", name: "Chargers", color: "#0080C6", logo: espnLogo("lac"), conference: "AFC", division: "West" },
  LAR: { abbr: "LAR", city: "Los Angeles", name: "Rams", color: "#003594", logo: espnLogo("lar"), conference: "NFC", division: "West" },
  LV: { abbr: "LV", city: "Las Vegas", name: "Raiders", color: "#000000", logo: espnLogo("lv"), conference: "AFC", division: "West" },
  MIA: { abbr: "MIA", city: "Miami", name: "Dolphins", color: "#008E97", logo: espnLogo("mia"), conference: "AFC", division: "East" },
  MIN: { abbr: "MIN", city: "Minnesota", name: "Vikings", color: "#4F2683", logo: espnLogo("min"), conference: "NFC", division: "North" },
  NE: { abbr: "NE", city: "New England", name: "Patriots", color: "#002244", logo: espnLogo("ne"), conference: "AFC", division: "East" },
  NO: { abbr: "NO", city: "New Orleans", name: "Saints", color: "#D3BC8D", logo: espnLogo("no"), conference: "NFC", division: "South" },
  NYG: { abbr: "NYG", city: "New York", name: "Giants", color: "#0B2265", logo: espnLogo("nyg"), conference: "NFC", division: "East" },
  NYJ: { abbr: "NYJ", city: "New York", name: "Jets", color: "#125740", logo: espnLogo("nyj"), conference: "AFC", division: "East" },
  PHI: { abbr: "PHI", city: "Philadelphia", name: "Eagles", color: "#004C54", logo: espnLogo("phi"), conference: "NFC", division: "East" },
  PIT: { abbr: "PIT", city: "Pittsburgh", name: "Steelers", color: "#FFB612", logo: espnLogo("pit"), conference: "AFC", division: "North" },
  SEA: { abbr: "SEA", city: "Seattle", name: "Seahawks", color: "#002244", logo: espnLogo("sea"), conference: "NFC", division: "West" },
  SF: { abbr: "SF", city: "San Francisco", name: "49ers", color: "#AA0000", logo: espnLogo("sf"), conference: "NFC", division: "West" },
  TB: { abbr: "TB", city: "Tampa Bay", name: "Buccaneers", color: "#D50A0A", logo: espnLogo("tb"), conference: "NFC", division: "South" },
  TEN: { abbr: "TEN", city: "Tennessee", name: "Titans", color: "#4B92DB", logo: espnLogo("ten"), conference: "AFC", division: "South" },
  WAS: { abbr: "WAS", city: "Washington", name: "Commanders", color: "#5A1414", logo: espnLogo("wsh"), conference: "NFC", division: "East" },
};

// Alphabetical by city then name - shared by every team picker (nav
// switcher, the team-select landing page) so they can't drift apart.
export const TEAMS_SORTED: Team[] = Object.values(TEAMS).sort((a, b) => `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`));
