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
import { coachFrom, depthChartAt, POSITIONS } from "./sync-players.mjs";

const QB = POSITIONS.find((p) => p.exportName === "QUARTERBACKS");
const WR = POSITIONS.find((p) => p.exportName === "WIDE_RECEIVERS");

const ATHLETES = {
  1: "Starter One",
  2: "Backup Two",
  3: "Receiver Three",
  4: "Receiver Four",
  5: "Receiver Five",
};

function stubFetch(payloads) {
  globalThis.fetch = async (url) => {
    const athlete = /athletes\/(\d+)/.exec(url);
    if (athlete) {
      const id = athlete[1];
      return { ok: true, json: async () => ({ id: Number(id), fullName: ATHLETES[id] }) };
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

console.log("all depth chart cases pass");
