// WHAT IS BEING AUCTIONED, as data.
//
// There are going to be a lot of these - a full roster off NFL teams, a
// quarterback room, receiving corps, defenses, and things that are not
// football at all - so the engine knows none of it. It knows there is a
// pool, that each player has slots to fill, and that everything in the
// pool gets sold. Everything else lives in a format.
//
// Same arrangement as tierTemplates.ts, and for the same reason: a new
// mode should be an entry in a file, not a change to the game.

export type SlotDef = {
  // Stable key. Used in saved state, so it does not change once a format
  // has been played.
  key: string;
  label: string;
};

export type AuctionItem = {
  id: string;
  // What goes on the card when it comes up for auction.
  label: string;
  // The line under it - a team's record, a player's team, whatever the
  // format wants somebody to be bidding on.
  subtitle?: string;
  imageUrl?: string;
  // Drives the card's glow. Team colour, usually.
  accent?: string;

  // WHICH SLOTS THIS CAN FILL, and what you actually get in each one.
  //
  // This is the difference between the two shapes of this game. Auction a
  // whole TEAM and the Bengals are worth Joe Burrow in the QB slot and
  // Chase and Higgins in the receiving slot - one item, different value
  // per slot, which is what makes two people bid on it for different
  // reasons. Auction PLAYERS and there is nothing to choose: a
  // quarterback fills a quarterback slot and is worth himself.
  //
  // So: present means "only these slots, and here is what each gives
  // you". Absent means "any open slot, worth its own label".
  fills?: Record<string, string>;

  // FOR THE OTHER SHAPE: an item that fills any slot and is worth
  // itself, so there is nothing to key a short form on. "Mahomes" where
  // label says "Patrick Mahomes".
  //
  // Written by the format rather than derived, because there is no rule
  // that works on both shapes: cutting the first word off a player's
  // name gives a surname, and off "Kansas City Chiefs" gives "City
  // Chiefs". Only the file that built the item knows which it is.
  short?: string;

  // The same thing, short enough to sit BESIDE a position label rather
  // than under it - "Prescott" where fills says "Dak Prescott".
  //
  // The overlay is a band between two cameras, so vertical space is the
  // scarce one and a name on its own line costs more than it is worth.
  // The item's own imageUrl rides along as the badge next to it, which is
  // what makes a surname on its own readable: "Prescott" plus a Cowboys
  // logo is unambiguous in a way that "Prescott" alone is not.
  fillsShort?: Record<string, string>;
};

export type AuctionFormat = {
  slug: string;
  title: string;
  tagline: string;
  // A word for the picker's tile. Every room of players is the same
  // 30px photograph of a man without one - Running Backs and Tight Ends
  // are indistinguishable as pictures alone.
  short: string;
  // Which shelf it sits on in the picker. Everything is football today;
  // the moment there is a draft that is not, one flat list is the
  // problem. Absent means the default shelf.
  category?: string;
  // THREE ITEM IDS FOR THE TILE, and the middle one is the face of the
  // mode, so this is written centre-first.
  //
  // A pool has no ranking in it. `depth` is per team - it says Chase is
  // Cincinnati's first receiver and nothing about whether he is better
  // than Jefferson, and there is no column that would answer that. So
  // this is an opinion, and it is kept in one place on purpose:
  // changing who fronts a mode is editing three strings.
  //
  // Absent falls back to a spread of the pool, which is right for a
  // mode whose items are all equally unknown.
  headliners?: string[];
  // Dollars each player starts with. Twenty is the version people play.
  budget: number;
  // What every player has to fill, in the order they are shown.
  slots: SlotDef[];
  items: AuctionItem[];
};

// The pool has to be exactly big enough that everyone fills every slot
// and nothing is skipped - see the note on `NO SKIPPING` in engine.ts.
// Getting this wrong is the kind of thing that looks fine until the last
// pick of a live stream, so it is checked rather than trusted.
export function poolSizeFor(format: AuctionFormat, playerCount: number): number {
  return format.slots.length * playerCount;
}

export function formatProblems(format: AuctionFormat, playerCount: number): string[] {
  const problems: string[] = [];
  const need = poolSizeFor(format, playerCount);

  if (format.slots.length === 0) problems.push("a format needs at least one slot");
  if (format.budget < 0) problems.push("budget cannot be negative");
  if (format.items.length < need) {
    problems.push(`needs ${need} items for ${playerCount} players, has ${format.items.length}`);
  }

  const slotKeys = new Set(format.slots.map((s) => s.key));
  if (slotKeys.size !== format.slots.length) problems.push("two slots share a key");

  const ids = new Set<string>();
  for (const item of format.items) {
    if (ids.has(item.id)) problems.push(`two items share the id ${item.id}`);
    ids.add(item.id);
    for (const key of Object.keys(item.fills ?? {})) {
      if (!slotKeys.has(key)) problems.push(`${item.label} fills "${key}", which is not a slot`);
    }
    // An item that can fill nothing would come up for auction and be
    // unwinnable, which stalls the draft with no way forward.
    if (item.fills && Object.keys(item.fills).length === 0) {
      problems.push(`${item.label} cannot fill any slot`);
    }
  }

  // HEADLINERS ARE HAND-TYPED NAMES against a pool a script rewrites
  // every week, which is the exact shape of thing that goes quietly
  // wrong: a player changes team or retires and his row is gone, and
  // the tile silently falls back to a stranger. Checked here so a sync
  // that drops one fails the format test instead.
  if (format.headliners) {
    if (format.headliners.length !== 3) {
      problems.push(`${format.slug} has ${format.headliners.length} headliners, wants 3`);
    }
    for (const id of format.headliners) {
      if (!ids.has(id)) problems.push(`${format.slug} headliner "${id}" is not in the pool`);
    }
  }

  return problems;
}

// The two runtime helpers that used to live here are in engine.ts now.
// This file is types plus the authoring-time check, and imports nothing,
// which is what lets the engine depend on it with `import type` alone -
// erased at runtime, so the rules can be run directly by a test with no
// build step in front of them.
