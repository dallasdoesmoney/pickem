// College -> athletic conference, for the daily puzzle's COLLEGE hint.
//
// This is what makes a college cell go yellow. Guess a Utah player when
// the answer went to BYU and you should learn something: both are Big
// 12. Exact-match-or-nothing wastes the most interesting column on the
// board, because two players sharing a college is rare and two players
// sharing a conference is not.
//
// Alignment is as of the 2026 season, which matters more than usual -
// realignment moved Texas and Oklahoma to the SEC, four Pac-12 schools to
// the Big Ten, four to the Big 12, and rebuilt the Pac-12 around Boise
// State and friends. A stale map here is a wrong hint, not a missing one,
// so re-check it each summer.
//
// Two judgement calls worth knowing about:
//
//   Notre Dame is a football independent but an ACC member in everything
//   else. Sixty players in the pool went there, and leaving them unable
//   to ever go yellow is worse than calling them ACC. Listed as ACC.
//
//   Schools are listed at their CURRENT conference, not the one they
//   played in. Delaware and Sam Houston are Conference USA now even for
//   players who were there when they were FCS. One rule, consistently
//   applied, beats a per-player era lookup nobody can verify.
//
// Colleges with no entry - Division II, Division III, Canadian schools,
// programs that no longer field a team - simply never go yellow. That is
// the intended behaviour: bucketing every small school into one bucket
// would make Ferris State and Tusculum "the same conference", which is a
// lie. See scripts/gen-puzzle-seed.mjs, which prints roster colleges that
// are missing from this map so new ones do not go unnoticed.

const BY_CONFERENCE: Record<string, string[]> = {
  SEC: [
    "Alabama", "Arkansas", "Auburn", "Florida", "Georgia", "Kentucky", "LSU",
    "Mississippi State", "Missouri", "Oklahoma", "Ole Miss", "South Carolina",
    "Tennessee", "Texas", "Texas A&M", "Vanderbilt",
  ],
  "Big Ten": [
    "Illinois", "Indiana", "Iowa", "Maryland", "Michigan", "Michigan State",
    "Minnesota", "Nebraska", "Northwestern", "Ohio State", "Oregon",
    "Penn State", "Purdue", "Rutgers", "UCLA", "USC", "Washington", "Wisconsin",
  ],
  ACC: [
    "Boston College", "California", "Clemson", "Duke", "Florida State",
    "Georgia Tech", "Louisville", "Miami", "NC State", "North Carolina",
    "Notre Dame", "Pittsburgh", "SMU", "Stanford", "Syracuse", "Virginia",
    "Virginia Tech", "Wake Forest",
  ],
  "Big 12": [
    "Arizona", "Arizona State", "Baylor", "BYU", "Cincinnati", "Colorado",
    "Houston", "Iowa State", "Kansas", "Kansas State", "Oklahoma State", "TCU",
    "Texas Tech", "UCF", "Utah", "West Virginia",
  ],
  "Pac-12": [
    "Boise State", "Colorado State", "Fresno State", "Oregon State",
    "San Diego State", "Texas State", "Utah State", "Washington State",
  ],
  American: [
    "Army", "Charlotte", "East Carolina", "Florida Atlantic", "Memphis", "Navy",
    "North Texas", "Rice", "South Florida", "Temple", "Tulane", "Tulsa", "UAB",
    "UTSA",
  ],
  "Mountain West": [
    "Air Force", "Hawai'i", "Nevada", "New Mexico", "Northern Illinois",
    "San José State", "UC Davis", "UNLV", "UTEP", "Wyoming",
  ],
  "Conference USA": [
    "Delaware", "Florida International", "Jacksonville State", "Kennesaw State",
    "Liberty", "Louisiana Tech", "Middle Tennessee", "Missouri State",
    "New Mexico State", "Sam Houston", "Western Kentucky",
  ],
  "Mid-American": [
    "Akron", "Ball State", "Bowling Green", "Buffalo", "Central Michigan",
    "Eastern Michigan", "Kent State", "Massachusetts", "Miami (OH)", "Ohio",
    "Toledo", "Western Michigan",
  ],
  "Sun Belt": [
    "App State", "Arkansas State", "Coastal Carolina", "Georgia Southern",
    "Georgia State", "James Madison", "Louisiana", "Marshall", "Old Dominion",
    "South Alabama", "Southern Miss", "Troy", "UL Monroe",
  ],

  // FCS below. Same rule, same yellow - a Montana player and a Montana
  // State player share the Big Sky, and that is exactly the kind of thing
  // someone who knows the answer's college would want confirmed.
  Ivy: ["Brown", "Dartmouth", "Harvard", "Pennsylvania", "Princeton", "Yale"],
  Patriot: ["Colgate", "Fordham", "Georgetown", "Holy Cross"],
  CAA: [
    "Bryant", "Campbell", "Elon", "Maine", "Monmouth", "New Hampshire",
    "North Carolina A&T", "Stony Brook", "Towson", "UAlbany", "Villanova",
    "William & Mary",
  ],
  "Big Sky": [
    "Cal Poly", "Eastern Washington", "Idaho", "Idaho State", "Montana",
    "Montana State", "Northern Arizona", "Sacramento State", "Weber State",
  ],
  "Missouri Valley": [
    "Illinois State", "Indiana State", "Murray State", "North Dakota",
    "North Dakota State", "Northern Iowa", "South Dakota", "South Dakota State",
    "Southern Illinois", "Western Illinois", "Youngstown State",
  ],
  Southern: ["Chattanooga", "East Tennessee State", "Furman", "Samford", "Wofford"],
  Southland: ["East Texas A&M", "Houston Christian", "SE Louisiana", "Stephen F. Austin"],
  SWAC: [
    "Alabama A&M", "Alabama State", "Alcorn State", "Florida A&M", "Grambling",
    "Jackson State", "Prairie View A&M", "Southern",
  ],
  MEAC: ["Howard", "Morgan State", "North Carolina Central", "South Carolina State"],
  "Big South-OVC": [
    "Lindenwood", "Robert Morris", "Southeast Missouri State", "Tennessee Tech",
  ],
  UAC: ["Austin Peay", "Central Arkansas", "Southern Utah", "Tarleton State", "Utah Tech"],
  Pioneer: ["Dayton", "Drake", "Marist", "San Diego"],
  Northeast: ["Duquesne", "Sacred Heart", "Wagner"],
};

export const COLLEGE_CONFERENCES: Record<string, string> = Object.fromEntries(
  Object.entries(BY_CONFERENCE).flatMap(([conference, colleges]) =>
    colleges.map((college) => [college, conference])
  )
);

export function collegeConference(college: string | null | undefined): string | null {
  if (!college) return null;
  return COLLEGE_CONFERENCES[college] ?? null;
}
