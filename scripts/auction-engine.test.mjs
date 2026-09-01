// The auction rules, tested without a browser or a network.
//
// The engine is a pure reduce(state, action), which is the whole reason
// it was built that way: the rules are the part that has to be right, and
// they can be wrong in ways nobody notices until the last pick of a live
// stream. So they are checked here rather than by playing.
import {
  startAuction,
  openLot,
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

// A lot now comes up "ready" and is started by the host, with a reel in
// between. That is the screen's business, not the rules', so these tests
// step over it: `play` opens any waiting lot before and after every
// action, and the rules read exactly as they did before it existed. The
// reveal sequence itself is checked on its own, further down.
const begun = (s, format = FORMAT) => (s.phase === "ready" ? openLot(s, format) : s);
const play = (state, ...actions) =>
  begun(actions.reduce((s, a) => reduce(begun(s), a, FORMAT), begun(state)));

// --- setup ------------------------------------------------------------
{
  const s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  ok("the pool is the whole list, not a slice", s.order.length === 4, `${s.order.length} items`);
  ok("everybody starts with the budget", s.players.every((p) => p.budget === 20), "");
  ok("everybody starts empty", s.players.every((p) => openSlots(p).length === 2), "");
  ok("player one opens the first item", toAct(s, FORMAT) === 0, "");
  ok("the format itself is legal", formatProblems(FORMAT, 2).length === 0, "");
}

// --- rule 2: the floor is zero, and somebody is on the hook for it ---
//
// Bidding opens at $0 and that $0 already belongs to whoever is on the
// clock. So they bid a DOLLAR or they pass; passing hands the free one
// across; if both pass it comes back to the first of them, wanted or not.
{
  const s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  ok("the cheapest opening move is a dollar", bidRange(s, FORMAT, 0).min === 1, "$0 is already theirs");
  ok("and bidding zero is refused", play(s, { type: "bid", by: 0, amount: 0 }) === s, "that would be bidding against yourself");
  ok("the other player cannot act first", play(s, { type: "bid", by: 1, amount: 5 }) === s, "");

  // P1 passes: the free one crosses the table.
  const offered = play(s, { type: "pass", by: 0 });
  ok("a pass at the floor does not end the lot", offered.phase === "bidding", "it offers it to the other player");
  ok("and it is now the other player's turn", toAct(offered, FORMAT) === 1, "");
  ok("who may take it for nothing", bidRange(offered, FORMAT, 1).min === 0, "");
  ok("and P1 does not get another turn", bidRange(offered, FORMAT, 0) === null, "a pass is final for the lot");

  const taken = play(offered, { type: "bid", by: 1, amount: 0 });
  ok("taking it at zero wins it outright", taken.phase === "assigning" && taken.won.by === 1 && taken.won.price === 0, "");
  const free = play(taken, { type: "assign", slotKey: "a" });
  ok("and costs nothing", free.players[1].budget === 20, "");
  ok("but fills a slot", openSlots(free.players[1]).length === 1, "");
}

// --- both pass, and the first one on the clock is stuck with it -------
{
  const s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  const stuck = play(s, { type: "pass", by: 0 }, { type: "pass", by: 1 });
  ok("if nobody wants it, it is not skipped", stuck.phase === "assigning", "rule 1");
  ok("it goes to whoever was on the clock first", stuck.won.by === 0, "P1 opened, so P1 eats it");
  ok("at nothing", stuck.won.price === 0, "");
  const done = play(stuck, { type: "assign", slotKey: "a" });
  ok("and it really did cost nothing", done.players[0].budget === 20, "");
}

// --- a dollar, then it is a normal auction ---------------------------
{
  const s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  const opened = play(s, { type: "bid", by: 0, amount: 1 });
  ok("a dollar puts it in play", opened.phase === "bidding" && opened.bid.amount === 1, "");
  ok("and the answer has to beat it", bidRange(opened, FORMAT, 1).min === 2, "");
  const sold = play(opened, { type: "pass", by: 1 });
  ok("passing on a real bid ends it", sold.phase === "assigning" && sold.won.by === 0 && sold.won.price === 1, "");
}

// --- bidding back and forth ------------------------------------------
{
  let s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
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
  let s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  s = play(s, { type: "bid", by: 0, amount: 20 }, { type: "pass", by: 1 }, { type: "assign", slotKey: "a" });
  ok("a player can spend everything", s.players[0].budget === 0, "");

  // Item two: the right to open has passed to P2. A broke P1 cannot
  // answer a $1 bid - beating it costs a dollar they do not have.
  const opened = play(s, { type: "bid", by: 1, amount: 1 });
  ok("a broke player cannot answer a dollar", bidRange(opened, FORMAT, 0) === null, "a reply has to beat it");
  ok("so the auction resolves instead of waiting on them", opened.phase === "assigning", "no dead pass button on stream");
  s = play(opened, { type: "assign", slotKey: "a" });

  // Item three: P1 is on the clock again with nothing. They cannot bid a
  // dollar, but rule 2 still keeps them in the game - the $0 is theirs
  // unless the other player takes it off them.
  ok("a broke opener cannot bid at all", bidRange(s, FORMAT, 0) === null, "a dollar is a dollar");
  ok("but they are still the one on the clock", toAct(s, FORMAT) === 0, "so passing still means something");
  const bothPass = play(s, { type: "pass", by: 0 }, { type: "pass", by: 1 });
  ok("and with nothing left they still get the slot", bothPass.won.by === 0 && bothPass.won.price === 0, "rule 2");
}

// --- rule 1 + 3: nothing is skipped, and a full roster is out --------
{
  // Drive a whole draft: P1 takes everything it can until it is full.
  let s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  const openerFirst = [];
  let guard = 0;
  while (s.phase !== "done" && guard++ < 20) {
    if (s.phase === "bidding") {
      const who = toAct(s, FORMAT);
      openerFirst.push(who);
      s = play(s, { type: "bid", by: who, amount: 1 });
      const answering = toAct(s, FORMAT);
      if (answering !== null) s = play(s, { type: "pass", by: answering });
    } else if (s.phase === "ready" || s.phase === "spinning") {
      s = begun(s);
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
  let s = begun(startAuction(FORMAT, ["P1", "P2"], "seed"));
  s = play(s, { type: "bid", by: 0, amount: 1 }, { type: "pass", by: 1 }, { type: "assign", slotKey: "a" });
  s = play(s, { type: "bid", by: 1, amount: 1 }, { type: "pass", by: 0 }, { type: "assign", slotKey: "a" });
  s = play(s, { type: "bid", by: 0, amount: 1 }, { type: "pass", by: 1 }, { type: "assign", slotKey: "b" });
  ok("P1 is full", openSlots(s.players[0]).length === 0, "");
  ok("and can no longer bid", !canBid(s, FORMAT, 0), "rule 3");
  ok("so the last item is P2's to open", toAct(s, FORMAT) === 1, "");
  const last = play(s, { type: "bid", by: 1, amount: 1 });
  ok("and resolves the moment they bid", last.phase === "assigning", "nobody left to answer");
  // The other half of rule 3 at the floor: with only one player eligible,
  // passing cannot hand it anywhere, so it comes straight back to them.
  const alone = play(s, { type: "pass", by: 1 });
  ok("and passing alone still lands it on them", alone.phase === "assigning" && alone.won.by === 1 && alone.won.price === 0, "");
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
  const base = begun(startAuction(RESTRICTED, ["P1", "P2"], "fixed"), RESTRICTED);
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
  const sold = reduce(state, { type: "bid", by: 1, amount: 1 }, RESTRICTED);
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

// --- starting a lot: ready -> spinning -> bidding ---------------------
//
// The one thing that must hold here is that NOBODY CAN BID AT A REEL.
// toAct is what every control on both screens keys off, so as long as it
// stays null until the reel lands, a bid button cannot appear over an
// animation - on the board or on the stream.
{
  const fresh = startAuction(FORMAT, ["P1", "P2"], "seed");
  ok("a lot comes up waiting to be started", fresh.phase === "ready", "");
  ok("and nobody is on the clock yet", toAct(fresh, FORMAT) === null, "no bid controls over a reel");
  ok("nor can anyone bid into it", bidRange(fresh, FORMAT, 0) === null, "");
  ok("a bid at a lot that has not started does nothing", reduce(fresh, { type: "bid", by: 0, amount: 3 }, FORMAT) === fresh, "");

  const spinning = reduce(fresh, { type: "spin" }, FORMAT);
  ok("start sets it spinning", spinning.phase === "spinning", "");
  ok("still nobody on the clock", toAct(spinning, FORMAT) === null, "");
  ok("a second press cannot restart the reel", reduce(spinning, { type: "spin" }, FORMAT) === spinning, "stream deck double-tap");

  const open = reduce(spinning, { type: "reveal" }, FORMAT);
  ok("landing opens the bidding", open.phase === "bidding", "");
  ok("and the opener is on the clock", toAct(open, FORMAT) === open.opener, "");
  ok("the lot itself never changed", open.order.join() === fresh.order.join() && open.index === fresh.index, "the reel lands on what was already drawn");

  // The board re-arms its timer when it reloads, so this genuinely can
  // arrive twice.
  ok("a second landing is ignored", reduce(open, { type: "reveal" }, FORMAT) === open, "");
  ok("revealing a lot nobody started is ignored", reduce(fresh, { type: "reveal" }, FORMAT) === fresh, "");

  // And the next lot goes back to waiting, rather than opening itself.
  const sold = play(open, { type: "bid", by: open.opener, amount: 1 }, { type: "pass", by: (open.opener + 1) % 2 });
  ok("the winner is choosing a slot", sold.phase === "assigning", "");
  const next = reduce(sold, { type: "assign", slotKey: slotsItemCanFill(currentItem(sold, FORMAT), openSlots(sold.players[sold.won.by]))[0] }, FORMAT);
  ok("the next lot waits to be started too", next.phase === "ready", "every lot gets its own spin");
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
