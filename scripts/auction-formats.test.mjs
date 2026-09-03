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
import { WIDE_RECEIVERS } from "../src/data/rosters/wrs.ts";
import { formatProblems } from "../src/lib/auction/format.ts";
import { startAuction, openLot, reduce, toAct, bidRange, currentItem, openSlots, slotsItemCanFill } from "../src/lib/auction/engine.ts";

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
      if (s.phase === "ready" || s.phase === "spinning") {
        // The host starts each lot; a fuzz run has no host.
        s = openLot(s, format);
      } else if (s.phase === "bidding") {
        const who = toAct(s, format);
        if (who === null) {
          stuck = true;
          break;
        }
        // Rule 2: the floor is $0 and it belongs to whoever is on the
        // clock, so the cheapest bid is a dollar until somebody passes.
        const range = bidRange(s, format, who);
        // Passing is ALWAYS legal and always means something now - at
        // the floor it offers the item across, and if the bot cannot
        // afford a dollar it is the only move it has.
        const next =
          !range || Math.random() < 0.45
            ? reduce(s, { type: "pass", by: who }, format)
            : reduce(s, {
                type: "bid",
                by: who,
                amount: range.min + Math.floor(Math.random() * Math.min(4, range.max - range.min + 1)),
              }, format);
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

// --- the right player, not the alphabetically first one --------------
//
// The roster files are sorted by NAME. A graphic that shows ONE receiver
// per team therefore has to be told which one, and the ordering it was
// given first was rebuilt from all.ts's `depthRank` - which counts EVERY
// slot on the chart, returners included, so a punt returner ties with the
// real WR1 and an alphabetical tiebreak decides. Washington came out
// McCaffrey and McLaurin, with Diggs nowhere.
//
// The check that shipped alongside that bug asserted the pick matched the
// `depth` field, which is the same wrong answer written twice. So this
// asserts against the ROSTER - the receiver has to be one this team
// actually has, and specifically the one ESPN's chart lists first - and
// against known-good cases.
{
  const teams = AUCTION_FORMATS["nfl-teams"];
  if (!teams) {
    ok("nfl-teams is registered", false, "rosters not synced in this checkout");
  } else {
    const strays = [];
    const notFirst = [];
    for (const item of teams.items) {
      const mine = WIDE_RECEIVERS.filter((w) => w.team === item.id);
      const pick = item.fills.rec ?? "";
      if (!pick) continue;
      // ONE name. The slot used to hold a pair, and "+" is how that read.
      if (pick.includes(" + ")) strays.push(`${item.id}: two names, "${pick}"`);
      if (!mine.some((w) => w.name === pick)) strays.push(`${item.id}: "${pick}" is not one of theirs`);
      // And the one the chart puts first, by depth - not by name order,
      // which is the bug this whole block exists for.
      const top = [...mine].sort((a, b) => (a.depth ?? 99) - (b.depth ?? 99))[0];
      if (top && top.name !== pick) notFirst.push(`${item.id}: got "${pick}", chart says "${top.name}"`);
    }
    ok("every receiver comes from that team's receivers", strays.length === 0, strays.slice(0, 3).join(" | "));
    ok("and is the one the depth chart lists first", notFirst.length === 0, notFirst.slice(0, 3).join(" | "));

    const wr = (id) => teams.items.find((i) => i.id === id)?.fills.rec ?? "no item";
    ok("Washington is McLaurin", wr("WAS") === "Terry McLaurin", wr("WAS"));
    ok("and not McCaffrey", !wr("WAS").includes("McCaffrey"), "he is their fourth receiver");
    ok("Minnesota is Justin Jefferson", wr("MIN") === "Justin Jefferson", wr("MIN"));
    ok("Dallas is CeeDee Lamb", wr("DAL") === "CeeDee Lamb", wr("DAL"));
    ok("Cincinnati is Ja'Marr Chase", wr("CIN") === "Ja'Marr Chase", wr("CIN"));

    // Every team fields one. A team with no receiver at all would come up
    // with a slot nobody can fill.
    const noWr = teams.items.filter((i) => !i.fills.rec);
    ok("every team has a receiver", noWr.length === 0, noWr.map((i) => i.id).join(", "));

    // Short forms exist for everything the long form covers, or the
    // overlay silently falls back to the full name and overflows.
    const missingShort = teams.items.filter((i) => Object.keys(i.fills).some((k) => !i.fillsShort?.[k]));
    ok("every fill has a short form too", missingShort.length === 0, missingShort.slice(0, 3).map((i) => i.id).join(", "));
    // The keys are in saved state and must not move; the labels are only
    // what goes on the graphic.
    ok("the receiver slot is labelled WR", teams.slots.some((s) => s.key === "rec" && s.label === "WR"), "");
    ok("and the defense slot Def", teams.slots.some((s) => s.key === "def" && s.label === "Def"), "");
    ok("the keys are untouched", teams.slots.map((s) => s.key).join(",") === "qb,rb,rec,te,def", teams.slots.map((s) => s.key).join(","));
  }
}

console.log(failed === 0 ? "\nall checks pass" : `\n${failed} check(s) failed`);
process.exit(failed === 0 ? 0 : 1);
