// Offline coverage for the depth chart parsing.
//
//   node scripts/sync-players.test.mjs
//
// ESPN is unreachable from the environment this was written in, so the
// only way to check the parsing before it runs for real is to feed it
// the shapes it will meet. The cases here are the ones that have already
// bitten once or look most likely to: roster order beating the chart,
// the position key's case moving around, an athlete $ref coming back as
// http, a receiver occupying two slots, and a team with no chart at all.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coachFrom, depthChartAt, POSITIONS, readOverrides, OVERRIDES } from "./sync-players.mjs";

const QB = POSITIONS.find((p) => p.exportName === "QUARTERBACKS");
const WR = POSITIONS.find((p) => p.exportName === "WIDE_RECEIVERS");

const ATHLETES = {
  1: "Starter One",
  2: "Backup Two",
  3: "Receiver Three",
  4: "Receiver Four",
  5: "Receiver Five",
  6: "Attributed Six",
};

// Attributes the daily puzzle grades on. Keyed by athlete id so a case
// can opt one player into having them and leave the others bare, which
// is the real ESPN behaviour - it publishes these for most players and
// not all.
// Athlete 6 and nobody else, so the bare-row cases above stay bare.
const ATTRS = {
  6: { height: 74, weight: 225, age: 41, jersey: "8", college: { name: "California" } },
};

function stubFetch(payloads) {
  globalThis.fetch = async (url) => {
    const athlete = /athletes\/(\d+)/.exec(url);
    if (athlete) {
      const id = athlete[1];
      return { ok: true, json: async () => ({ id: Number(id), fullName: ATHLETES[id], ...(ATTRS[id] ?? {}) }) };
    }
    if (url in payloads) return { ok: true, json: async () => payloads[url] };
    return { ok: false, status: 404, statusText: "Not Found" };
  };
}

const CHART = "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/teams/T/depthcharts";
const ref = (id, proto = "https") => `${proto}://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/athletes/${id}`;

// 1. Rank wins, and a lowercase position key is still matched.
stubFetch({
  [CHART]: {
    items: [{ positions: { qb: { position: { abbreviation: "qb" }, athletes: [
      { rank: 2, athlete: { $ref: ref(2) } },
      { rank: 1, athlete: { $ref: ref(1) } },
    ] } } }],
  },
});
assert.deepEqual(await depthChartAt(2026, "T", QB.slots, 1), [{ espnId: "1", name: "Starter One" }]);

// 2. An http $ref is upgraded rather than followed into a redirect.
stubFetch({
  [CHART]: {
    items: [{ positions: { QB: { position: { abbreviation: "QB" }, athletes: [
      { rank: 1, athlete: { $ref: ref(1, "http") } },
    ] } } }],
  },
});
assert.deepEqual(await depthChartAt(2026, "T", QB.slots, 1), [{ espnId: "1", name: "Starter One" }]);

// 3. Receivers: three rank-1 slots, take the first two by slot order,
//    and never the same player twice even when he occupies two of them.
stubFetch({
  [CHART]: {
    items: [{ positions: {
      lwr: { position: { abbreviation: "LWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(3) } }] },
      rwr: { position: { abbreviation: "RWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(4) } }] },
      swr: { position: { abbreviation: "SWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(5) } }] },
    } }],
  },
});
assert.deepEqual(await depthChartAt(2026, "T", WR.slots, 2), [
  { espnId: "3", name: "Receiver Three" },
  { espnId: "4", name: "Receiver Four" },
]);

// 3b. THE ONE THE ANSWER POOL RELIES ON. A team's three WR rows each
//     have their own STARTER, and all three are answers - so asking for
//     three has to return all three rank-1 receivers and stop, rather
//     than reaching into anybody's second string. This is what
//     `perTeam: 3` is buying, and the ordering is slot order because
//     every rank is 1.
assert.deepEqual(await depthChartAt(2026, "T", WR.slots, WR.perTeam), [
  { espnId: "3", name: "Receiver Three" },
  { espnId: "4", name: "Receiver Four" },
  { espnId: "5", name: "Receiver Five" },
]);
assert.equal(WR.perTeam, 3, "a team starts three receivers, and all three can be the answer");

// 3c. A rank-2 receiver must NOT displace a rank-1 in a different slot,
//     which is the exact way an offline reconstruction gets this wrong:
//     the depth ranks stored on the roster are a player's best across
//     every slot, so a returner listed second at WR can carry a 1.
stubFetch({
  [CHART]: {
    items: [{ positions: {
      lwr: { position: { abbreviation: "LWR" }, athletes: [
        { rank: 1, athlete: { $ref: ref(3) } },
        { rank: 2, athlete: { $ref: ref(6) } },
      ] },
      rwr: { position: { abbreviation: "RWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(4) } }] },
      swr: { position: { abbreviation: "SWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(5) } }] },
    } }],
  },
});
assert.deepEqual(await depthChartAt(2026, "T", WR.slots, WR.perTeam), [
  { espnId: "3", name: "Receiver Three" },
  { espnId: "4", name: "Receiver Four" },
  { espnId: "5", name: "Receiver Five" },
]);

// 4. The same receiver in two slots must not fill both places.
stubFetch({
  [CHART]: {
    items: [
      { positions: {
        lwr: { position: { abbreviation: "LWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(3) } }] },
        swr: { position: { abbreviation: "SWR" }, athletes: [{ rank: 1, athlete: { $ref: ref(3) } }] },
      } },
      { positions: {
        rwr: { position: { abbreviation: "RWR" }, athletes: [{ rank: 2, athlete: { $ref: ref(5) } }] },
      } },
    ],
  },
});
assert.deepEqual(await depthChartAt(2026, "T", WR.slots, 2), [
  { espnId: "3", name: "Receiver Three" },
  { espnId: "5", name: "Receiver Five" },
]);

// 5. A defensive slot never counts as a receiver.
stubFetch({
  [CHART]: {
    items: [{ positions: { cb: { position: { abbreviation: "CB" }, athletes: [{ rank: 1, athlete: { $ref: ref(4) } }] } } }],
  },
});
assert.deepEqual(await depthChartAt(2026, "T", WR.slots, 2), []);

// 6. No chart at all falls through quietly, for the caller to top up.
stubFetch({});
assert.deepEqual(await depthChartAt(2026, "T", QB.slots, 1), []);

// ---- head coaches ----------------------------------------------------
// ESPN has carried the coach as `coach`, as `coaches`, and as a wrapped
// list. All three are read, because a shape change here does not throw -
// it silently drops a team out of the list.
// The roster response, which is where it actually lives - a top-level
// `coach` array beside `athletes`. The first version looked on the team
// object and found nothing for all 32.
const coach = (payload) => {
  const c = coachFrom(payload);
  return c && { espnId: c.espnId, name: c.name, headshot: c.headshot, titled: c.titled };
};
assert.deepEqual(coach({ athletes: [], coach: [{ id: 7, firstName: "Andy", lastName: "Reid" }] }),
  { espnId: "7", name: "Andy Reid", headshot: "", titled: false });
assert.deepEqual(coach({ team: { coach: [{ id: 11, displayName: "Kyle Shanahan" }] } }),
  { espnId: "11", name: "Kyle Shanahan", headshot: "", titled: false });

// THE one that matters. That array is the whole staff, and taking [0]
// put Jesse Minter in for Baltimore and Todd Monken in for Cleveland -
// coordinators, in a head coach list, looking entirely normal.
assert.deepEqual(
  coach({
    coach: [
      { id: 1, displayName: "Some Coordinator", position: { name: "Offensive Coordinator" } },
      { id: 2, displayName: "The Boss", position: { name: "Head Coach" } },
    ],
  }),
  { espnId: "2", name: "The Boss", headshot: "", titled: true },
);
// Titles have come through as a plain string and as displayName too.
assert.equal(coach({ coach: [{ id: 3, displayName: "A" }, { id: 4, displayName: "B", position: "head coach" }] })?.espnId, "4");
assert.equal(coach({ coach: [{ id: 5, displayName: "A" }, { id: 6, displayName: "B", title: "Head Coach" }] })?.espnId, "6");
// Nothing titled: falls back to the first, and says it was a guess.
assert.equal(coach({ coach: [{ id: 9, displayName: "Only One" }] })?.titled, false);

// A picture ESPN hands over beats one we build.
assert.equal(
  coach({ coach: [{ id: 12, displayName: "X", headshot: { href: "https://img/x.png" } }] })?.headshot,
  "https://img/x.png",
);

// An id with no name is not a coach, and neither is a name with no id -
// either one writes a row that renders as a blank tile.
assert.equal(coachFrom({ coach: { id: 10 } }), null);
assert.equal(coachFrom({ coach: { firstName: "No", lastName: "Id" } }), null);
assert.equal(coachFrom({}), null);
assert.equal(coachFrom(undefined), null);

// The puzzle attributes: captured when ESPN publishes them, and the key
// LEFT OUT when it does not. Writing `undefined` instead looks identical
// in most comparisons and is not - it broke the two cases above when
// this capture was first added.
stubFetch({
  [CHART]: {
    items: [{ positions: { QB: { position: { abbreviation: "QB" }, athletes: [
      { rank: 1, athlete: { $ref: ref(6) } },
      { rank: 2, athlete: { $ref: ref(2) } },
    ] } } }],
  },
});
const withAttrs = await depthChartAt(2026, "T", QB.slots, 2);
assert.deepEqual(withAttrs[0], {
  espnId: "6",
  name: "Attributed Six",
  heightIn: 74,
  weightLb: 225,
  age: 41,
  jersey: 8,
  college: "California",
});
// Athlete 2 has none of them, and carries none of the keys.
assert.deepEqual(withAttrs[1], { espnId: "2", name: "Backup Two" });
assert.equal("heightIn" in withAttrs[1], false);

console.log("all depth chart cases pass");

// ---------------------------------------------------------------- overrides
//
// The first version of this shipped broken and the run still reported
// success: readFileSync was never imported, so every call threw, the
// catch turned that into "no overrides", and Seattle kept the player a
// person had explicitly replaced. An override that silently does nothing
// is worse than none, because the board looks hand-checked and is not.
// So the parse is tested, and it is tested against the REAL file.
const overrides = readOverrides();
assert.ok(overrides instanceof Map, "readOverrides returns a Map");

// Whatever src/data/rosterOverrides.ts currently holds has to parse. An
// entry that does not parse is an entry that does nothing.
const raw = readFileSync(new URL("../src/data/rosterOverrides.ts", import.meta.url), "utf8");
const declared = [...raw.matchAll(/^\s*"([A-Z]{2,3} [A-Z]{1,3})":/gm)].map((m) => m[1]);
assert.deepEqual(
  [...overrides.keys()].sort(),
  declared.sort(),
  `every override in the file must parse - declared ${declared.length}, parsed ${overrides.size}`,
);
for (const [key, ids] of overrides) {
  assert.ok(ids.length > 0, `${key} names at least one player`);
  for (const id of ids) assert.match(id, /^\d+$/, `${key} holds ESPN ids`);
}

// Every override has to name a position the sync actually knows about,
// and give it the number of players that position takes - otherwise it
// either never fires or fails the run at the very end of a long fetch.
for (const [key, ids] of overrides) {
  const code = key.split(" ")[1];
  const position = POSITIONS.find((p) => p.code === code);
  assert.ok(position, `${key} names a position the sync knows (${POSITIONS.map((p) => p.code).join(", ")})`);
  assert.equal(ids.length, position.perTeam, `${key} names ${position.perTeam} player(s)`);
}

// And the module-level OVERRIDES, which is what syncPosition actually
// consults - the bug was that this was empty while the file was fine.
assert.equal(OVERRIDES.size, overrides.size, "the module read the same overrides the parser does");
console.log(`overrides parse: ${overrides.size} entr${overrides.size === 1 ? "y" : "ies"} (${[...overrides.keys()].join(", ") || "none"})`);
