// Putting back picks a failed write dropped on the floor.
//
// The save path deletes before it inserts. If the insert is refused, the
// delete has already committed and the board is empty - which is exactly
// what happened when the kickoff policy went live while the old
// whole-week save was still deployed: the delete took the fifteen open
// games, the insert was refused because of the one started game in the
// same statement, and every one of those fifteen was gone.
//
// The device's own copy survives that, because it is written on every
// change and never touched by a failed server write. This covers the
// rules for reading it back - which are narrow, because the dangerous
// version of this feature is the one that overrules the account.

import { healFromLocalCopy } from "../src/lib/pickHeal.ts";

let failed = 0;
function ok(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} ${name.padEnd(56)} ${detail}`);
  if (!cond) failed++;
}

// Week 1: the Wednesday opener has been played, Sunday has not.
const STARTED = "2026-w1-ne-sea";
const SUN_A = "2026-w1-tb-cin";
const SUN_B = "2026-w1-no-det";
const PICKS_KEY = "pickem:picks:week-1";
const LOCK_KEY = "pickem:lock:week-1";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
function device(picks, lock = null) {
  store.clear();
  store.set(PICKS_KEY, JSON.stringify(picks));
  if (lock) store.set(LOCK_KEY, lock);
}
const heal = (dbPicks, dbLock = null) => healFromLocalCopy(dbPicks, dbLock, PICKS_KEY, LOCK_KEY, 1);

// --- the wipe this exists for ------------------------------------------
// The account kept only the started game (RLS refused to delete it); the
// device still has the whole board.
device({ [STARTED]: "NE", [SUN_A]: "TB", [SUN_B]: "DET" });
let r = heal({ [STARTED]: "NE" });
ok("restores what the failed write dropped", r.restored === 2, JSON.stringify(r.picks));
ok("keeps the row that survived", r.picks[STARTED] === "NE");
ok("Sunday picks are back", r.picks[SUN_A] === "TB" && r.picks[SUN_B] === "DET");

// --- the account always wins -------------------------------------------
// A pick made on another device must not be overruled by a stale copy on
// this one. This is the failure mode that would make the feature worse
// than the bug.
device({ [SUN_A]: "TB" });
r = heal({ [SUN_A]: "CIN" });
ok("account beats a stale local copy", r.picks[SUN_A] === "CIN", `${r.picks[SUN_A]}, restored ${r.restored}`);
ok("no restore means no write-back", r.restored === 0);

// --- never onto a played game ------------------------------------------
// The whole point of the lock. A device that remembers picking the
// Wednesday game does not get to put that back after it was played.
device({ [STARTED]: "NE", [SUN_A]: "TB" });
r = heal({});
ok("will not restore a kicked-off game", r.picks[STARTED] === undefined, JSON.stringify(r.picks));
ok("still restores the open ones", r.picks[SUN_A] === "TB" && r.restored === 1);

// --- nothing to do -----------------------------------------------------
device({});
r = heal({ [SUN_A]: "TB" });
ok("empty device is a no-op", r.restored === 0 && r.picks[SUN_A] === "TB");
store.clear();
r = heal({ [SUN_A]: "TB" });
ok("absent device copy is a no-op", r.restored === 0 && r.picks[SUN_A] === "TB");
device({ [SUN_A]: "TB" });
r = heal({ [SUN_A]: "TB" });
ok("identical copies are a no-op", r.restored === 0, "no pointless write-back");

// Corrupt or legacy values must not throw - this runs on page load for
// everybody, and a crash here is a blank board for a stored string
// nobody remembers writing.
store.clear();
store.set(PICKS_KEY, "not json{{");
r = heal({ [SUN_A]: "TB" });
ok("corrupt local copy is survivable", r.restored === 0 && r.picks[SUN_A] === "TB");
store.set(PICKS_KEY, JSON.stringify({ [SUN_B]: { nested: true } }));
r = heal({});
ok("non-string team is skipped", r.restored === 0);

// --- the lock ----------------------------------------------------------
device({ [SUN_A]: "TB", [SUN_B]: "DET" }, SUN_A);
r = heal({});
ok("lock comes back with its game", r.lockedGameId === SUN_A, String(r.lockedGameId));

device({ [SUN_A]: "TB" }, SUN_A);
r = heal({ [SUN_B]: "DET" }, SUN_B);
ok("account's lock is not overruled", r.lockedGameId === SUN_B, String(r.lockedGameId));

device({ [SUN_A]: "TB" }, STARTED);
r = heal({});
ok("lock on a played game is dropped", r.lockedGameId === null, String(r.lockedGameId));

device({ [SUN_A]: "TB" }, "2026-w1-not-a-game");
r = heal({});
ok("lock on an unknown game is dropped", r.lockedGameId === null, String(r.lockedGameId));

console.log(failed === 0 ? "\nall pick-heal checks pass" : `\n${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
