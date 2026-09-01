import type { AuctionFormat, AuctionItem } from "./format";

// Which of a player's open slots this item is allowed into. A rule, so it
// lives with the rules.
export function slotsItemCanFill(item: AuctionItem, openSlotKeys: string[]): string[] {
  if (!item.fills) return openSlotKeys;
  const fills = item.fills;
  return openSlotKeys.filter((key) => key in fills);
}

// What the item is worth in the slot it ends up in - "Joe Burrow" for the
// Bengals in a QB slot. Falls back to the item's own name for formats
// where the item IS the thing.
export function fillLabel(item: AuctionItem, slotKey: string): string {
  return item.fills?.[slotKey] ?? item.label;
}

// The auction, as a pure function of state and an action.
//
// No React, no network, no clock. Everything the game knows how to do is
// `reduce(state, action) -> state`, which is what lets the same rules run
// on a laptop in hotseat mode and behind a broadcast channel later
// without a second implementation to keep in step.
//
// THE THREE RULES, from how the game is actually played:
//
// 1. NO SKIPPING. Every item that comes up is sold - the draft does not
//    let anyone wait for a better one. Everybody ends up full and the
//    last few picks are forced, which is the tense part. The one
//    exception is an item NOBODY can use, which is passed over rather
//    than allowed to stall the draft; see advance().
//
// 2. THE FLOOR IS ZERO, AND SOMEBODY IS ALWAYS ON THE HOOK FOR IT.
//    Bidding opens at $0. Whoever is on the clock either bids a dollar or
//    passes - they cannot bid nothing, because nothing is already theirs.
//    Passing hands that free claim to the other player, who may take it
//    at $0 or pass it back; if BOTH pass, it returns to whoever was on
//    the clock first and they take it at $0 whether they want it or not.
//
//    A pass is final for that lot - having declined at nothing, you do
//    not get to come back over the top at a dollar.
//
//    This is what makes the game safe: nobody can ever be priced out of
//    filling their roster, so there is no need for the "hold back a
//    dollar per empty slot" rule these games usually need.
//
// 3. YOU CAN ONLY BID IF YOU HAVE A SLOT FOR IT. Once your roster is
//    full you are out, and everything left goes to whoever is still
//    filling. Together with rule 1 this is what makes "everyone fills
//    every slot" and "nothing is skipped" both true at once.

export type PlayerIndex = number;

export type RosterEntry = {
  itemId: string;
  price: number;
  // What they actually got - "Joe Burrow" rather than "Cincinnati
  // Bengals" - resolved at assignment time so the board does not have to
  // reach back into the format to draw itself.
  label: string;
  // The same thing at graphic size: a surname, and the badge that makes a
  // surname legible on its own. Resolved here for the same reason as
  // `label` - the overlay draws from state alone, so an overlay that
  // reconnects mid-draft needs no second lookup to fill its rails.
  short?: string;
  badge?: string;
};

export type PlayerState = {
  name: string;
  budget: number;
  // slot key -> what is in it, or null while empty.
  roster: Record<string, RosterEntry | null>;
};

export type Bid = { by: PlayerIndex; amount: number };

export type AuctionState = {
  formatSlug: string;
  players: PlayerState[];
  // Item ids in the order they come up. Fixed when the game starts, so a
  // reconnecting overlay sees the same draft rather than a new shuffle.
  order: string[];
  index: number;
  // A lot comes up "ready" - drawn, but not shown. The host starts it,
  // which puts it in "spinning" while the reel runs, and only then does
  // bidding open.
  //
  // These are phases rather than a flag beside the state because toAct()
  // keys off the phase: during a spin it returns null, so there is no way
  // for a bid button to appear over a reel that has not landed yet. A
  // separate "revealed" boolean would have needed the same guard added by
  // hand in every place that draws a control.
  phase: "ready" | "spinning" | "bidding" | "assigning" | "done";
  // Who has to open the bidding on the current item. Alternates, so the
  // advantage of opening is shared.
  opener: PlayerIndex;
  // The standing bid. Null means nobody has put a dollar on it yet - the
  // lot is still sitting at the $0 floor.
  bid: Bid | null;
  // Who has passed on this lot. A pass is final for the lot, so this is
  // also the list of people who can no longer take it. When everybody
  // eligible is in here, the item goes at $0 to whoever was on the clock
  // first - see settle().
  passed: PlayerIndex[];
  // Set while phase is "assigning": who won, and what they paid.
  won: { by: PlayerIndex; price: number } | null;
  // Every sale, oldest first. What the overlay draws as the ticker.
  history: { itemId: string; by: PlayerIndex; price: number; slotKey: string; label: string }[];
};

export type AuctionAction =
  | { type: "spin" }
  | { type: "reveal" }
  | { type: "bid"; by: PlayerIndex; amount: number }
  | { type: "pass"; by: PlayerIndex }
  | { type: "assign"; slotKey: string };

// Straight from a fresh lot to open bidding. The two steps exist for the
// screen - somebody presses start, a reel runs - and a rules test has no
// screen, so it says what it means and moves on.
export function openLot(state: AuctionState, format: AuctionFormat): AuctionState {
  return reduce(reduce(state, { type: "spin" }, format), { type: "reveal" }, format);
}

// A tiny seeded shuffle, so a draft is reproducible from its seed. Tests
// need that, and it means a room can be rebuilt from a short string
// rather than from a list of forty item ids.
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffled<T>(items: T[], seed: number): T[] {
  const next = mulberry32(seed);
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function startAuction(format: AuctionFormat, names: string[], seed: string): AuctionState {
  // THE WHOLE POOL, shuffled, not a slice exactly the size of the need.
  //
  // The first version dealt precisely slots x players items and stopped.
  // That is correct only if every item can fill every slot, and with real
  // rosters it cannot: a team whose depth chart is missing a running back
  // fills fewer slots than one that is not, and an item that nobody has a
  // slot for is unwinnable. Dealt exactly-to-size, one of those ends the
  // draft early with empty rosters - mid-stream, with no way forward.
  //
  // So the pool is the whole list, the game ends when everybody is FULL
  // rather than when the list runs out, and an item nobody can use is
  // passed over. In the ordinary case nothing is ever passed over and the
  // game plays exactly as described; this is the safety net under it.
  const order = shuffled(format.items, seedFrom(seed)).map((item) => item.id);

  const state: AuctionState = {
    formatSlug: format.slug,
    players: names.map((name) => ({
      name,
      budget: format.budget,
      roster: Object.fromEntries(format.slots.map((s) => [s.key, null])),
    })),
    order,
    index: 0,
    phase: "bidding",
    opener: 0,
    bid: null,
    passed: [],
    won: null,
    history: [],
  };

  // An item nobody can use could be first, so the opening position gets
  // the same treatment as every position after it.
  return advance(state, format);
}

// Move to the next item anybody can actually bid on, and end the game
// when every roster is full. The one place that decides a draft is over.
export function advance(state: AuctionState, format: AuctionFormat): AuctionState {
  let s = state;
  for (;;) {
    if (s.players.every((p) => openSlots(p).length === 0)) return { ...s, phase: "done", bid: null, passed: [], won: null };
    // Ran out of pool with slots still open. formatProblems is what stops
    // this reaching a stream; ending cleanly is what stops it hanging if
    // it ever does.
    if (s.index >= s.order.length) return { ...s, phase: "done", bid: null, passed: [], won: null };
    if (s.players.some((_, i) => couldUse(s, format, i))) {
      // Held at "ready" rather than opening straight into bidding: the
      // host starts each lot, so there is a beat to talk over before the
      // reel runs.
      return { ...s, phase: "ready", bid: null, passed: [], won: null };
    }
    s = { ...s, index: s.index + 1 };
  }
}

export function openSlots(player: PlayerState): string[] {
  return Object.entries(player.roster)
    .filter(([, entry]) => entry === null)
    .map(([key]) => key);
}

export function currentItem(state: AuctionState, format: AuctionFormat): AuctionItem | null {
  const id = state.order[state.index];
  return format.items.find((i) => i.id === id) ?? null;
}

// Can this player take part in the auction for the item on the block?
// Rule 3: a full roster is out. An item with a restricted `fills` is also
// out for anyone whose remaining slots it cannot go into - a
// quarterback-only card is worth nothing to somebody who has already
// filled their quarterback slot, and letting them bid it up would be a
// way to burn the other player's money with no risk.
export function couldUse(state: AuctionState, format: AuctionFormat, who: PlayerIndex): boolean {
  const item = currentItem(state, format);
  if (!item) return false;
  return slotsItemCanFill(item, openSlots(state.players[who])).length > 0;
}

export function canBid(state: AuctionState, format: AuctionFormat, who: PlayerIndex): boolean {
  return state.phase === "bidding" && couldUse(state, format, who);
}

// Whose action the game is waiting for. Null in "assigning" (the winner
// is choosing a slot) and at the end.
//
// AFFORDABILITY IS PART OF THIS, not just slots. Somebody who has spent
// everything still has slots to fill, so canBid is true for them - but
// they cannot beat a standing bid of anything, including zero, because a
// reply has to BEAT it. Handing them the turn anyway left them a single
// dead button on a live stream: pass, which was the only legal move.
// Now the auction just resolves.
//
// The opener is exempt, because an opening bid may be zero and everybody
// can afford that. That is rule 2 doing its job: being broke can cost you
// a contested item, never a slot.
// Everybody who could take this item, opener first. The order matters:
// it decides who is on the clock, and therefore who ends up holding the
// $0 if nobody wants it.
function eligibleOrder(state: AuctionState, format: AuctionFormat): PlayerIndex[] {
  return state.players
    .map((_, i) => i)
    .filter((i) => couldUse(state, format, i))
    .sort((a, b) => (a === state.opener ? -1 : b === state.opener ? 1 : a - b));
}

// Whose action the game is waiting for. Null in "assigning" (the winner
// is choosing a slot), during a reel, and at the end.
//
// A PASS IS FINAL. Somebody who declined the item at nothing does not get
// handed the turn again at a dollar, which is what makes "pass, and the
// other player may have it for free" a real decision rather than a feint.
//
// AFFORDABILITY IS PART OF THIS once there is a standing bid. Somebody
// who has spent everything still has slots to fill, so canBid is true for
// them - but they cannot beat a standing bid of anything, including zero,
// because a reply has to BEAT it. Handing them the turn anyway left them
// a single dead button on a live stream: pass, which was the only legal
// move. Now the auction just resolves.
//
// At the $0 floor there is no such thing as unaffordable, so everybody
// eligible gets their turn there however broke they are. That is rule 2
// doing its job: being broke can cost you a contested item, never a slot.
export function toAct(state: AuctionState, format: AuctionFormat): PlayerIndex | null {
  if (state.phase !== "bidding") return null;
  // `?? []` because a state broadcast by an older board has no `passed`
  // at all. OBS caches a browser source hard, so the two ends can sit a
  // deploy apart - and an overlay that throws is a black hole on a live
  // stream. Treating it as "nobody has passed" degrades to the old
  // behaviour instead of crashing.
  const passed = state.passed ?? [];
  const live = eligibleOrder(state, format).filter((i) => !passed.includes(i));
  if (live.length === 0) return null;
  if (!state.bid) return live[0];
  const standing = state.bid;
  const answering = live.filter((i) => i !== standing.by && state.players[i].budget >= standing.amount + 1);
  return answering.length > 0 ? answering[0] : null;
}

export function highestAffordable(state: AuctionState, who: PlayerIndex): number {
  return state.players[who].budget;
}

// What a legal bid looks like right now, or null if this player cannot
// bid at all. Exposed so the UI can disable buttons rather than let
// somebody press one and be told no on stream.
export function bidRange(state: AuctionState, format: AuctionFormat, who: PlayerIndex): { min: number; max: number } | null {
  if (!canBid(state, format, who)) return null;
  if (toAct(state, format) !== who) return null;
  // Rule 2. Sitting at the floor with nobody having passed, the cheapest
  // thing you can do is a DOLLAR - $0 is already yours if nobody wants
  // it, so bidding it would be bidding against yourself. Once somebody
  // has passed, the free one is genuinely on the table and the next
  // player may take it at $0. A reply to a real bid has to beat it,
  // which is what ends the auction rather than letting it loop.
  const min = state.bid ? state.bid.amount + 1 : (state.passed ?? []).length > 0 ? 0 : 1;
  const max = highestAffordable(state, who);
  return min > max ? null : { min, max };
}

function settle(state: AuctionState, format: AuctionFormat): AuctionState {
  if (state.bid) return { ...state, phase: "assigning", won: { by: state.bid.by, price: state.bid.amount } };

  // Nobody put a dollar on it and everybody passed. It goes at $0 to
  // whoever was on the clock first, wanted or not - rule 2. They are not
  // asked, because there is nobody left to ask.
  const order = eligibleOrder(state, format);
  // Unreachable in practice: advance() has already guaranteed somebody
  // could use this item. It steps over rather than throwing, because the
  // one thing a live draft must never do is stop with no way forward.
  if (order.length === 0) return advance({ ...state, index: state.index + 1 }, format);
  return { ...state, phase: "assigning", won: { by: order[0], price: 0 } };
}

export function reduce(state: AuctionState, action: AuctionAction, format: AuctionFormat): AuctionState {
  if (state.phase === "done") return state;

  // The host starts the lot. Only ever from "ready", so a second press of
  // the button - or a stray click on a stream deck - cannot restart a
  // reel that is already running or replay one that has landed.
  if (action.type === "spin") return state.phase === "ready" ? { ...state, phase: "spinning" } : state;

  // The reel finished. Sent by the board on a timer rather than by a
  // person, and idempotent for the same reason: the board re-arms that
  // timer when it reloads, so this can arrive twice.
  if (action.type === "reveal") return state.phase === "spinning" ? { ...state, phase: "bidding" } : state;

  if (action.type === "bid") {
    const range = bidRange(state, format, action.by);
    if (!range) return state;
    if (action.amount < range.min || action.amount > range.max) return state;
    const next: AuctionState = { ...state, bid: { by: action.by, amount: action.amount } };
    // If nobody is left who could answer, the bid stands and we go
    // straight to assignment - which is also what makes a $0 opening
    // against a full-rostered opponent resolve immediately.
    return toAct(next, format) === null ? settle(next, format) : next;
  }

  if (action.type === "pass") {
    if (toAct(state, format) !== action.by) return state;
    // Final for this lot, whether there is a standing bid or not. With a
    // bid on the table that ends the auction; at the floor it hands the
    // free one to the other player, and if they pass too it comes back
    // to whoever was on the clock first at $0.
    const next: AuctionState = { ...state, passed: [...(state.passed ?? []), action.by] };
    return toAct(next, format) === null ? settle(next, format) : next;
  }

  if (action.type === "assign") {
    if (state.phase !== "assigning" || !state.won) return state;
    const item = currentItem(state, format);
    if (!item) return state;
    const who = state.won.by;
    const player = state.players[who];
    if (!slotsItemCanFill(item, openSlots(player)).includes(action.slotKey)) return state;

    const label = item.fills?.[action.slotKey] ?? item.label;
    const short = item.fillsShort?.[action.slotKey] ?? label;
    const entry: RosterEntry = { itemId: item.id, price: state.won!.price, label, short, badge: item.imageUrl };
    const players = state.players.map((p, i) =>
      i === who
        ? {
            ...p,
            budget: p.budget - state.won!.price,
            roster: { ...p.roster, [action.slotKey]: entry },
          }
        : p
    );

    const history = [...state.history, { itemId: item.id, by: who, price: state.won.price, slotKey: action.slotKey, label }];

    return advance(
      {
        ...state,
        players,
        history,
        index: state.index + 1,
        // The right to open alternates regardless of who won, so winning
        // an item does not also cost you the opening bid on the next one.
        opener: (state.opener + 1) % state.players.length,
        bid: null,
        passed: [],
        won: null,
      },
      format
    );
  }

  return state;
}

// Total spent, for the overlay's standings line.
export function spent(player: PlayerState, startingBudget: number): number {
  return startingBudget - player.budget;
}
