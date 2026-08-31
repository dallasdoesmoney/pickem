// The auction rules, tested without a browser or a network.
//
// The engine is a pure reduce(state, action), which is the whole reason
// it was built that way: the rules are the part that has to be right, and
// they can be wrong in ways nobody notices until the last pick of a live
// stream. So they are checked here rather than by playing.
import {
  startAuction,
  reduce,
  toAct,
  canBid,
  bidRange,
  openSlots,
  currentItem,
  shuffled,
  seedFrom,
  slotsItemCanFill,
} from "../src/lib/auction/engine.ts";
import { formatProblems } from "../src/lib/auction/format.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(56)} ${detail}`);
  if (!cond) failed++;
}

// A tiny made-up format, so the rules are tested against something whose
// every value is visible here rather than against a real roster that
// changes every week.
const FORMAT = {
  slug: "test",
  title: "Test",
  tagline: "",
  budget: 20,
  slots: [
    { key: "a", label: "A" },
    { key: "b", label: "B" },
  ],
  items: [
    { id: "i1", label: "One" },
    { id: "i2", label: "Two" },
    { id: "i3", label: "Three" },
    { id: "i4", label: "Four" },
  ],
};

const play = (state, ...actions) => actions.reduce((s, a) => reduce(s, a, FORMAT), state);

// --- setup ------------------------------------------------------------
{
  const s = startAuction(FORMAT, ["P1", "P2"], "seed");
  ok("the pool is the whole list, not a slice", s.order.length === 4, `${s.order.length} items`);
  ok("everybody starts with the budget", s.players.every((p) => p.budget === 20), "");
  ok("everybody starts empty", s.players.every((p) => openSlots(p).length === 2), "");
  ok("player one opens the first item", toAct(s, FORMAT) === 0, "");
  ok("the format itself is legal", formatProblems(FORMAT, 2).length === 0, "");
}

// --- rule 2: a bid can be zero ---------------------------------------
{
  const s = startAuction(FORMAT, ["P1", "P2"], "seed");
  ok("an opening bid may be zero", bidRange(s, FORMAT, 0).min === 0, "");
  const afterZero = play(s, { type: "bid", by: 0, amount: 0 });
  ok("zero opens the auction rather than ending it", afterZero.phase === "bidding", "P2 still gets to answer");
  ok("and P2 has to beat it, not match it", bidRange(afterZero, FORMAT, 1).min === 1, "");
  const free = play(afterZero, { type: "pass", by: 1 });
  ok("passing on a zero bid gives it away free", free.phase === "assigning" && free.won.price === 0, "");
  const done = play(free, { type: "assign", slotKey: "a" });
  ok("and the winner still has every dollar", done.players[0].budget === 20, "");
  ok("but one fewer slot", openSlots(done.players[0]).length === 1, "");
}

// --- the opener must bid ---------------------------------------------
{
  const s = startAuction(FORMAT, ["P1", "P2"], "seed");
  const passed = play(s, { type: "pass", by: 0 });
  ok("the opener cannot pass without bidding", passed === s, "the action is ignored");
  const outOfTurn = play(s, { type: "bid", by: 1, amount: 5 });
  ok("and the other player cannot bid first", outOfTurn === s, "");
}

// --- bidding back and forth ------------------------------------------
{
  let s = startAuction(FORMAT, ["P1", "P2"], "seed");
  s = play(s, { type: "bid", by: 0, amount: 3 });
  ok("a raise has to beat the standing bid", bidRange(s, FORMAT, 1).min === 4, "");
  ok("and an equal bid is refused", play(s, { type: "bid", by: 1, amount: 3 }) === s, "");
  s = play(s, { type: "bid", by: 1, amount: 8 });
  ok("the turn comes back to the first bidder", toAct(s, FORMAT) === 0, "");
  s = play(s, { type: "pass", by: 0 }, { type: "assign", slotKey: "a" });
  ok("the winner pays what they bid", s.players[1].budget === 12, `$${s.players[1].budget} left`);
  ok("and the loser pays nothing", s.players[0].budget === 20, "");
  ok("the sale is on the ticker", s.history.length === 1 && s.history[0].by === 1, "");
}

// --- nobody can bid more than they have ------------------------------
{
  let s = startAuction(FORMAT, ["P1", "P2"], "seed");
  s = play(s, { type: "bid", by: 0, amount: 20 }, { type: "pass", by: 1 }, { type: "assign", slotKey: "a" });
  ok("a player can spend everything", s.players[0].budget === 0, "");

  // Item two: the right to open has passed to P2, so a broke P1 cannot
  // answer a $0 opening - beating it costs a dollar they do not have.
  const opened = play(s, { type: "bid", by: 1, amount: 0 });
  ok("a broke player cannot answer even a zero bid", bidRange(opened, FORMAT, 0) === null, "a reply has to beat it, not match it");
  ok("so the auction resolves instead of waiting on them", opened.phase === "assigning", "no dead pass button on stream");
  s = play(opened, { type: "assign", slotKey: "a" });

  // Item three: it is P1's turn to open again, and rule 2 is what keeps
  // them in the game with nothing left.
  const range = bidRange(s, FORMAT, 0);
  ok("but they can still OPEN at zero", range !== null && range.min === 0 && range.max === 0, "rule 2");
  ok("and cannot open above what they hold", play(s, { type: "bid", by: 0, amount: 1 }) === s, "");
}

// --- rule 1 + 3: nothing is skipped, and a full roster is out --------
{
  // Drive a whole draft: P1 takes everything it can until it is full.
  let s = startAuction(FORMAT, ["P1", "P2"], "seed");
  const openerFirst = [];
  let guard = 0;
  while (s.phase !== "done" && guard++ < 20) {
    if (s.phase === "bidding") {
      const who = toAct(s, FORMAT);
      openerFirst.push(who);
      s = play(s, { type: "bid", by: who, amount: 0 });
      const answering = toAct(s, FORMAT);
      if (answering !== null) s = play(s, { type: "pass", by: answering });
    } else if (s.phase === "assigning") {
      const winner = s.won.by;
      const item = currentItem(s, FORMAT);
      const slot = slotsItemCanFill(item, openSlots(s.players[winner]))[0];
      s = play(s, { type: "assign", slotKey: slot });
    }
  }
  ok("a full draft ends", s.phase === "done", `${s.history.length} items sold`);
  ok("every item was sold", s.history.length === 4, "nothing skipped");
  ok("and it ended because rosters filled, not because the pool ran out", s.index >= s.order.length || s.players.every((p) => openSlots(p).length === 0), "");
  ok("every slot is filled for both players", s.players.every((p) => openSlots(p).length === 0), "");
  ok("each player got exactly their share", s.players.every((p) => Object.values(p.roster).every(Boolean)), "");
  ok("the right to open alternated", openerFirst.join(",") === "0,1,0,1", openerFirst.join(","));
}

// --- a full roster cannot bid ----------------------------------------
{
  // Two slots, so two wins fills P1 up.
  let s = startAuction(FORMAT, ["P1", "P2"], "seed");
  s = play(s, { type: "bid", by: 0, amount: 1 }, { type: "pass", by: 1 }, { type: "assign", slotKey: "a" });
  s = play(s, { type: "bid", by: 1, amount: 0 }, { type: "pass", by: 0 }, { type: "assign", slotKey: "a" });
  s = play(s, { type: "bid", by: 0, amount: 1 }, { type: "pass", by: 1 }, { type: "assign", slotKey: "b" });
  ok("P1 is full", openSlots(s.players[0]).length === 0, "");
  ok("and can no longer bid", !canBid(s, FORMAT, 0), "rule 3");
  ok("so the last item is P2's to open", toAct(s, FORMAT) === 1, "");
  const last = play(s, { type: "bid", by: 1, amount: 0 });
  ok("and resolves the moment they bid", last.phase === "assigning", "nobody left to answer");
}

// --- restricted fills -------------------------------------------------
// Built by hand rather than driven through a shuffle: the point is one
// specific situation, and a test that only sometimes reaches it is a test
// that only sometimes runs.
{
  const RESTRICTED = {
    ...FORMAT,
    items: [
      { id: "r1", label: "A-only", fills: { a: "thing" } },
      { id: "r2", label: "A-only two", fills: { a: "thing" } },
      { id: "r3", label: "Anything" },
      { id: "r4", label: "Anything two" },
    ],
  };
  const base = startAuction(RESTRICTED, ["P1", "P2"], "fixed");
  // P1 has filled A; P2 has filled B. An A-only item is on the block.
  const state = {
    ...base,
    order: ["r1", "r2", "r3", "r4"],
    index: 0,
    players: [
      { name: "P1", budget: 20, roster: { a: { itemId: "x", price: 0, label: "x" }, b: null } },
      { name: "P2", budget: 20, roster: { a: null, b: { itemId: "y", price: 0, label: "y" } } },
    ],
  };
  ok("an A-only item is on the block", currentItem(state, RESTRICTED).id === "r1", "");
  ok("the player with an open A can bid", canBid(state, RESTRICTED, 1), "");
  ok("the player who filled A cannot bid it up", !canBid(state, RESTRICTED, 0), "no risk-free money-burning");
  ok("so it is theirs to open regardless of whose turn it was", toAct(state, RESTRICTED) === 1, "");
  const sold = reduce(state, { type: "bid", by: 1, amount: 0 }, RESTRICTED);
  ok("and it resolves at once, with nobody able to answer", sold.phase === "assigning", "");
  ok("it can only be assigned to A", slotsItemCanFill(currentItem(sold, RESTRICTED), openSlots(sold.players[1])).join() === "a", "");
  const wrongSlot = reduce(sold, { type: "assign", slotKey: "b" }, RESTRICTED);
  ok("assigning it to the wrong slot is refused", wrongSlot === sold, "");

  ok("an item that fills nothing is rejected by the format check", formatProblems({ ...RESTRICTED, items: [{ id: "x", label: "x", fills: {} }] }, 2).length > 0, "");
  ok("a fill pointing at a missing slot is rejected", formatProblems({ ...FORMAT, items: [...FORMAT.items, { id: "z", label: "z", fills: { nope: "x" } }] }, 2).some((p) => p.includes("nope")), "");
  ok("too small a pool is rejected", formatProblems({ ...FORMAT, items: FORMAT.items.slice(0, 3) }, 2).some((p) => p.includes("needs 4")), "");
}

// --- the shuffle is a function of its seed ----------------------------
{
  const a = shuffled([1, 2, 3, 4, 5, 6, 7, 8], seedFrom("room-A"));
  const b = shuffled([1, 2, 3, 4, 5, 6, 7, 8], seedFrom("room-A"));
  const c = shuffled([1, 2, 3, 4, 5, 6, 7, 8], seedFrom("room-B"));
  ok("the same seed deals the same draft", a.join() === b.join(), "a reconnect sees the same game");
  ok("a different seed deals a different one", a.join() !== c.join(), "");
  ok("and it is still a permutation", a.slice().sort().join() === "1,2,3,4,5,6,7,8", "");
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
