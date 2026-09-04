// THE ONE THING THIS BROWSER REMEMBERS ABOUT ITSELF.
//
// A random opaque string, made up here, used for exactly one purpose:
// letting "how many people played today" count somebody who has never
// signed in. It is not an account, it is not linked to one, and it says
// nothing about who is holding the phone.
//
// PER BROWSER, NOT PER ACCOUNT, and that is what makes the count work
// in both directions: a guest is counted, and a guest who later signs up
// is not counted a second time, because the key does not change
// underneath them.

const KEY = "pickem:player-key";
// One key per calendar day is all the server needs, so the client
// remembers which day it has already reported and stops asking.
const SENT = "pickem:player-key-sent";

// 24 characters of [a-z0-9], which the database's own constraint also
// insists on. crypto.randomUUID would do, but hyphens and a fixed shape
// invite being read as an identifier with meaning; this has none.
function mint(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 24);
}

// Returns null rather than throwing anywhere storage is unavailable -
// a private window, a browser set to block site data, an embedded
// webview. Somebody in that position simply does not get counted, which
// is the correct trade: a counter must never be able to break the game
// it counts.
export function playerKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const held = window.localStorage.getItem(KEY);
    if (held && /^[a-z0-9]{16,64}$/.test(held)) return held;
    const made = mint();
    window.localStorage.setItem(KEY, made);
    return made;
  } catch {
    return null;
  }
}

// Whether today's play has already been reported from this browser.
// The server is idempotent either way - the primary key sees to that -
// so this is only about not making the same call eight times in a row.
export function alreadyCounted(day: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(SENT) === day;
  } catch {
    // Cannot remember, so report every time. The database deduplicates,
    // so the cost is a wasted round trip and never a wrong number.
    return false;
  }
}

export function markCounted(day: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SENT, day);
  } catch {
    // Nothing to do. See above.
  }
}
