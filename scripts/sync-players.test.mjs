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
import { depthChartAt, POSITIONS } from "./sync-players.mjs";

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

console.log("all depth chart cases pass");
