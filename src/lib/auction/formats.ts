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
//               Bengals; whether that is Joe Burrow or Chase and Higgins
//               is your decision after you win.
//
//   qb-room     one item, one meaning. Four quarterbacks, four slots,
//               and the only question is what each is worth.
//
// Everything after this - receiving corps, defenses, coaches, whatever -
// is one of those two shapes with different data, which is why the engine
// never learns what any of it is.

function firstFor<T extends { team: string; name: string }>(rows: T[], abbr: string): T | undefined {
  return rows.find((r) => r.team === abbr);
}

function twoFor<T extends { team: string; name: string }>(rows: T[], abbr: string): T[] {
  return rows.filter((r) => r.team === abbr).slice(0, 2);
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
  const wrs = twoFor(WIDE_RECEIVERS, abbr);
  const te = firstFor(TIGHT_ENDS, abbr);

  const fills: Record<string, string> = {};
  if (qb) fills.qb = qb.name;
  if (rb) fills.rb = rb.name;
  if (wrs.length > 0) fills.rec = wrs.map((w) => w.name).join(" + ");
  if (te) fills.te = te.name;
  // Every team has a defense, so this one never depends on a synced
  // roster - which also means a fresh clone can still deal a legal game.
  fills.def = `${team.name} defense`;

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
  };
}

const NFL_TEAMS: AuctionFormat = {
  slug: "nfl-teams",
  title: "NFL Teams",
  tagline: "Bid on a team, then decide what you took it for",
  budget: 20,
  slots: [
    { key: "qb", label: "QB" },
    { key: "rb", label: "RB" },
    { key: "rec", label: "Receiving" },
    { key: "te", label: "TE" },
    { key: "def", label: "Defense" },
  ],
  items: TEAMS_SORTED.map((t) => teamItem(t.abbr)).filter((i): i is AuctionItem => i !== null),
};

// The other shape: the item IS the thing. No `fills`, so any quarterback
// goes in any quarterback slot and is worth himself.
const QB_ROOM: AuctionFormat = {
  slug: "qb-room",
  title: "Quarterback Room",
  tagline: "Four quarterbacks each. Nothing else matters",
  budget: 20,
  slots: [
    { key: "qb1", label: "QB 1" },
    { key: "qb2", label: "QB 2" },
    { key: "qb3", label: "QB 3" },
    { key: "qb4", label: "QB 4" },
  ],
  items: QUARTERBACKS.map((q) => ({
    id: q.espnId,
    label: q.name,
    subtitle: TEAMS[q.team] ? `${TEAMS[q.team].city} ${TEAMS[q.team].name}` : q.team,
    imageUrl: espnHeadshot(q.espnId),
    accent: TEAMS[q.team]?.color,
  })),
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
