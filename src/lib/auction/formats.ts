import { TEAMS, TEAMS_SORTED } from "@/data/teams";
import { QUARTERBACKS } from "@/data/rosters/qbs";
import { RUNNING_BACKS } from "@/data/rosters/rbs";
import { WIDE_RECEIVERS } from "@/data/rosters/wrs";
import { TIGHT_ENDS } from "@/data/rosters/tes";
import { espnHeadshot } from "@/lib/espnImages";
import type { AuctionFormat, AuctionItem } from "./format";

// The modes. Two to start, and they are deliberately the two DIFFERENT
// SHAPES rather than two of the same thing:
//
//   nfl-teams   one item, different value per slot. You bid on the
//               Bengals; whether that is Joe Burrow or Ja'Marr Chase is
//               your decision after you win. Shown as "Full Roster" -
//               the team is the lot, the roster is the prize.
//
//   qb-room     one item, one meaning. Four quarterbacks, four slots,
//               and the only question is what each is worth.
//
// Everything after this - receiving corps, defenses, coaches, whatever -
// is one of those two shapes with different data, which is why the engine
// never learns what any of it is.

// THE ROSTER FILES ARE SORTED BY NAME, not by depth.
//
// That is fine for a tier list, where all three receivers are on screen
// at once, and wrong here, where one receiver goes on a graphic: taking
// the first row for Minnesota gave Jauan Jennings and left Justin
// Jefferson out of the Vikings entirely.
//
// The chart position each row was chosen at is now kept on the row, so
// this asks for it. Rows with no depth sort last rather than jumping the
// queue, which keeps an unsynced or partial file merely wrong-ish
// instead of confidently wrong.
//
// `depth` is written by the sync straight off ESPN's chart, in the order
// the chart lists them. It was briefly rebuilt from all.ts's depthRank
// instead, which is the best rank a player holds ANYWHERE on the chart -
// returners included - so a punt returner tied with a real WR1 and an
// alphabetical tiebreak decided between them. Nine teams were wrong.
// scripts/sync-players.test.mjs has a case for it now.
type Roster = { team: string; name: string; depth?: number };

function byDepth<T extends Roster>(rows: T[], abbr: string): T[] {
  return rows.filter((r) => r.team === abbr).sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99));
}

function firstFor<T extends Roster>(rows: T[], abbr: string): T | undefined {
  return byDepth(rows, abbr)[0];
}

// "Justin Jefferson" -> "Jefferson", "Brian Thomas Jr." -> "Thomas Jr.",
// "Amon-Ra St. Brown" -> "St. Brown". Everything after the first name,
// which keeps the suffixes and the two-word surnames that a naive "last
// word" would cut in half.
function surname(name: string): string {
  const cut = name.indexOf(" ");
  return cut === -1 ? name : name.slice(cut + 1);
}

// A whole team as one lot. What it is worth depends entirely on where you
// put it, which is the point: the same card is a quarterback to one
// bidder and a receiving corps to the other, and they are bidding against
// each other for different reasons.
function teamItem(abbr: string): AuctionItem | null {
  const team = TEAMS[abbr as keyof typeof TEAMS];
  if (!team) return null;

  const qb = firstFor(QUARTERBACKS, abbr);
  const rb = firstFor(RUNNING_BACKS, abbr);
  const wr = firstFor(WIDE_RECEIVERS, abbr);
  const te = firstFor(TIGHT_ENDS, abbr);

  const fills: Record<string, string> = {};
  const fillsShort: Record<string, string> = {};
  if (qb) {
    fills.qb = qb.name;
    fillsShort.qb = surname(qb.name);
  }
  if (rb) {
    fills.rb = rb.name;
    fillsShort.rb = surname(rb.name);
  }
  // ONE receiver, not two. A pair was the only slot on the board holding
  // two names, so it was the only slot whose chip could not be read at a
  // glance - "SUTTON + WADDLE" at the size a pair forces is a smaller
  // name than every other pick on the graphic, for a slot that is not
  // more important than they are. The WR1 is the receiver anybody names
  // when you say the team.
  if (wr) {
    fills.rec = wr.name;
    fillsShort.rec = surname(wr.name);
  }
  if (te) {
    fills.te = te.name;
    fillsShort.te = surname(te.name);
  }
  // Every team has a defense, so this one never depends on a synced
  // roster - which also means a fresh clone can still deal a legal game.
  fills.def = `${team.name} defense`;
  fillsShort.def = team.name;

  // A team that cannot fill anything would come up and be unwinnable.
  // Only possible in a checkout where the rosters have never been synced.
  if (Object.keys(fills).length === 0) return null;

  return {
    id: abbr,
    label: `${team.city} ${team.name}`,
    subtitle: `${team.conference} ${team.division}`,
    imageUrl: team.logo,
    accent: team.color,
    fills,
    fillsShort,
  };
}

// Headliners are written as NAMES and resolved to ids here, because an
// espnId is not a thing anybody can check by reading it - "3139477" is
// either Patrick Mahomes or a typo and the file cannot tell you which.
//
// All three or none. Two headliners and a stranger reads as something
// half-loaded; a clean fall back to a spread of the pool just reads as
// a mode without a face yet. This is also what makes it safe against
// the weekly sync: a player who leaves the league takes the trio with
// him rather than leaving a hole.
function idsByName(items: AuctionItem[], names: string[]): string[] | undefined {
  const found = names.map((n) => items.find((i) => i.label === n)?.id).filter((id): id is string => Boolean(id));
  return found.length === names.length ? found : undefined;
}

const NFL_TEAMS: AuctionFormat = {
  // THE SLUG STAYS. It is what a room broadcasts and what an OBS
  // browser source carries in ?format=, so changing it would break
  // every bookmarked overlay URL to rename a label. Only the title is
  // the label.
  slug: "nfl-teams",
  // Named for what you END UP WITH, not for what comes up on the reel.
  // The lot is a team; the thing being built is one whole roster - a
  // quarterback, a back, a receiver, a tight end and a defense, each
  // taken off a different team you won. "NFL Teams" described the pool
  // and named a different game: ranking the thirty-two, which is what
  // the tier list of that name actually is.
  title: "Full Roster",
  short: "ROSTER",
  category: "NFL",
  tagline: "Bid on a team, then decide what you took it for",
  // Three crests anybody recognises, the middle one biggest. Teams, so
  // these are ids already and cannot go stale the way a player can.
  headliners: ["KC", "DAL", "PHI"],
  budget: 20,
  slots: [
    // The keys never change - they are in saved state - but the labels
    // are just what goes on the graphic. Short ones, because the spine
    // draws them at 42px between two rosters and every character is
    // width the picks do not get.
    { key: "qb", label: "QB" },
    { key: "rb", label: "RB" },
    { key: "rec", label: "WR" },
    { key: "te", label: "TE" },
    { key: "def", label: "Def" },
  ],
  items: TEAMS_SORTED.map((t) => teamItem(t.abbr)).filter((i): i is AuctionItem => i !== null),
};

// The other shape: the item IS the thing. No `fills`, so any quarterback
// goes in any quarterback slot and is worth himself.
const QB_ITEMS: AuctionItem[] = QUARTERBACKS.map((q) => ({
  id: q.espnId,
  label: q.name,
  subtitle: TEAMS[q.team] ? `${TEAMS[q.team].city} ${TEAMS[q.team].name}` : q.team,
  imageUrl: espnHeadshot(q.espnId),
  accent: TEAMS[q.team]?.color,
}));

const QB_ROOM: AuctionFormat = {
  slug: "qb-room",
  title: "Quarterback Room",
  short: "QB",
  category: "NFL",
  tagline: "Four quarterbacks each. Nothing else matters",
  headliners: idsByName(QB_ITEMS, ["Josh Allen", "Patrick Mahomes", "Lamar Jackson"]),
  budget: 20,
  slots: [
    { key: "qb1", label: "QB 1" },
    { key: "qb2", label: "QB 2" },
    { key: "qb3", label: "QB 3" },
    { key: "qb4", label: "QB 4" },
  ],
  items: QB_ITEMS,
};

// Registered off the length of the pool, the same way tierTemplates.ts
// does it: a checkout whose rosters have never been synced offers the
// modes it can actually deal rather than one full of blanks.
export const AUCTION_FORMATS: Record<string, AuctionFormat> = Object.fromEntries(
  [NFL_TEAMS, QB_ROOM].filter((f) => f.items.length >= f.slots.length * 2).map((f) => [f.slug, f])
);

export function getAuctionFormat(slug: string): AuctionFormat | undefined {
  return AUCTION_FORMATS[slug];
}
