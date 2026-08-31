// The REAL formats, against the REAL rosters, played to the end many
// times over.
//
// The engine test uses a made-up format whose every value is visible in
// the file. This one is the other half: the shipped modes, built from
// depth charts that change every week, played through by a bot that takes
// random legal actions. What it is looking for is the failure that only
// happens with real data - a team whose roster is missing a running back
// fills fewer slots than one that is not, and an item nobody can use used
// to be able to end a draft early with empty rosters.
//
// That is a mid-stream failure with no way forward, so it is worth a
// thousand simulated drafts to know it cannot happen.
import { AUCTION_FORMATS } from "../src/lib/auction/formats.ts";
import { formatProblems } from "../src/lib/auction/format.ts";
import { startAuction, reduce, toAct, currentItem, openSlots, slotsItemCanFill } from "../src/lib/auction/engine.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(52)} ${detail}`);
  if (!cond) failed++;
}

const DRAFTS = 500;
const formats = Object.values(AUCTION_FORMATS);

ok("there are formats to play", formats.length > 0, formats.map((f) => f.slug).join(", "));

for (const format of formats) {
  console.log(`\n-- ${format.slug}: ${format.items.length} items, ${format.slots.length} slots, $${format.budget}`);

  ok(`${format.slug} is a legal format`, formatProblems(format, 2).length === 0, formatProblems(format, 2).join("; "));

  // Every item has to be usable somewhere, or it is dead weight in the
  // pool that the draft has to step over.
  const dead = format.items.filter((i) => i.fills && Object.keys(i.fills).length === 0);
  ok(`${format.slug} has no item that fills nothing`, dead.length === 0, dead.map((d) => d.label).join(", "));

  // How thin is the thinnest item? Not a failure - the engine copes - but
  // worth seeing, because it is the number that decides how often the
  // draft has to step over something.
  const fillCounts = format.items.map((i) => (i.fills ? Object.keys(i.fills).length : format.slots.length));
  const thinnest = Math.min(...fillCounts);
  console.log(`   thinnest item fills ${thinnest} of ${format.slots.length} slots`);

  let finished = 0;
  let everyoneFull = 0;
  let solvent = 0;
  let skipped = 0;
  let worstStep = 0;

  for (let n = 0; n < DRAFTS; n++) {
    let s = startAuction(format, ["A", "B"], `seed-${n}`);
    let guard = 0;
    let stuck = false;

    while (s.phase !== "done" && guard++ < 2000) {
      if (s.phase === "bidding") {
        const who = toAct(s, format);
        if (who === null) {
          stuck = true;
          break;
        }
        const min = s.bid ? s.bid.amount + 1 : 0;
        const max = s.players[who].budget;
        if (min > max) {
          stuck = true;
          break;
        }
        // Sometimes pass, sometimes raise by a random legal amount.
        const next =
          s.bid && Math.random() < 0.45
            ? reduce(s, { type: "pass", by: who }, format)
            : reduce(s, { type: "bid", by: who, amount: min + Math.floor(Math.random() * Math.min(4, max - min + 1)) }, format);
        if (next === s) {
          stuck = true;
          break;
        }
        s = next;
      } else {
        const before = s.index;
        const item = currentItem(s, format);
        const options = slotsItemCanFill(item, openSlots(s.players[s.won.by]));
        if (options.length === 0) {
          stuck = true;
          break;
        }
        s = reduce(s, { type: "assign", slotKey: options[Math.floor(Math.random() * options.length)] }, format);
        // How far the draft had to step to find the next usable item.
        worstStep = Math.max(worstStep, s.index - before);
        skipped += Math.max(0, s.index - before - 1);
      }
    }

    if (stuck || s.phase !== "done") continue;
    finished++;
    if (s.players.every((p) => openSlots(p).length === 0)) everyoneFull++;
    if (s.players.every((p) => p.budget >= 0)) solvent++;
  }

  ok(`${format.slug}: every draft finished`, finished === DRAFTS, `${finished}/${DRAFTS}`);
  ok(`${format.slug}: everybody filled every slot`, everyoneFull === DRAFTS, `${everyoneFull}/${DRAFTS}`);
  ok(`${format.slug}: nobody went overdrawn`, solvent === DRAFTS, `${solvent}/${DRAFTS}`);
  console.log(`   items stepped over across ${DRAFTS} drafts: ${skipped} (longest single step ${worstStep})`);
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
