import { TEAMS, TEAMS_SORTED } from "@/data/teams";
import type { TeamAbbr } from "@/data/teams";
import { WR_ORDER } from "@/data/rosters/wrOrder";
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

// THE ROSTER FILES ARE SORTED BY NAME, not by depth.
//
// That is fine for a tier list, where all three receivers are on screen
// at once, and wrong here, where only the top two go on a graphic: taking
// the first two rows for Minnesota gave Jauan Jennings and Jordan
// Addison, and left Justin Jefferson out of the Vikings entirely.
//
// The chart position each row was chosen at is now kept on the row, so
// this asks for it. Rows with no depth sort last rather than jumping the
// queue, which keeps an unsynced or partial file merely wrong-ish
// instead of confidently wrong.
//
// The `depth` currently in the files was REBUILT from a field that turned
// out to mean something else, and is unreliable for nine teams - see
// src/data/rosters/wrOrder.ts, which overrules it by hand until the next
// sync writes the real thing.
type Roster = { team: string; name: string; depth?: number };

function byDepth<T extends Roster>(rows: T[], abbr: string): T[] {
  const mine = rows.filter((r) => r.team === abbr);
  const named = WR_ORDER[abbr as TeamAbbr];
  // IT RETIRES ITSELF. A hand-written order is a patch over a chart that
  // was wrong, and the moment the chart moves on it is a patch over
  // nothing - so it only applies while every player it names is still
  // one of that team's receivers. When the sync drops one of them, this
  // stops applying and the real depth takes over, with no window in
  // between where either source is the wrong one.
  const current = new Set(mine.map((r) => r.name));
  if (named && named.every((n) => current.has(n))) {
    // Anyone it does not mention keeps their place behind the ones it
    // does, so a partial list is still an improvement rather than a way
    // to lose a player.
    const rank = (r: T) => {
      const at = named.indexOf(r.name);
      return at === -1 ? named.length + (r.depth ?? 99) : at;
    };
    return mine.slice().sort((a, b) => rank(a) - rank(b));
  }
  return mine.sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99));
}

function firstFor<T extends Roster>(rows: T[], abbr: string): T | undefined {
  return byDepth(rows, abbr)[0];
}

function twoFor<T extends Roster>(rows: T[], abbr: string): T[] {
  return byDepth(rows, abbr).slice(0, 2);
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
  const wrs = twoFor(WIDE_RECEIVERS, abbr);
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
  if (wrs.length > 0) {
    fills.rec = wrs.map((w) => w.name).join(" + ");
    fillsShort.rec = wrs.map((w) => surname(w.name)).join(" + ");
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

const NFL_TEAMS: AuctionFormat = {
  slug: "nfl-teams",
  title: "NFL Teams",
  tagline: "Bid on a team, then decide what you took it for",
  budget: 20,
  slots: [
    { key: "qb", label: "QB" },
    { key: "rb", label: "RB" },
    { key: "rec", label: "WR Duo" },
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
