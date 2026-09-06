import type { AuctionState } from "./engine";
import { channelFor } from "@/lib/rooms";

// THE ROOM: what ties the board you play on to the graphic in OBS.
//
// A room is just a random code. It is not a database row, it is not owned
// by an account, and nothing about it is stored on a server - it is a
// channel name that two browser tabs agree on. That is deliberate:
//
//   - No sign-in. The code is unguessable, and it is the only thing that
//     grants access, so an account would add a login to the ninety
//     seconds before going live without protecting anything extra.
//   - No table, no migration, no RLS. Supabase Realtime broadcast is
//     ephemeral; the messages are never written down.
//
// What the code IS worth protecting: anyone holding it can send to the
// channel, and the overlay would draw what they sent. It lives in an OBS
// source's settings, not on screen, so the realistic way to leak it is to
// screen-share the OBS config. Rotating it is one button.

// The code, the channel and the two event names are shared with every
// other game that has a board and an overlay - see src/lib/rooms.ts.
// Re-exported here so nothing that already imports them has to move.
export { newRoomCode, isRoomCode, HELLO, STATE } from "@/lib/rooms";

export function roomChannel(code: string): string {
  return channelFor("versus", code);
}

// WHOLE STATE, EVERY TIME - never a delta.
//
// A dropped or out-of-order broadcast then costs nothing: the next action
// overwrites everything and the overlay is correct again. Deltas would
// desync once and stay desynced for the rest of the draft, on stream,
// with no way to fix it short of reloading the source.
export type BoardMessage = { slug: string; state: AuctionState };

// Anything at all can arrive on a channel, and the overlay is the one
// screen that must not throw - a crashed browser source is a black hole
// in the middle of a live stream. So nothing gets drawn until it has been
// checked, and a message that fails is dropped rather than rendered.
export function isBoardMessage(value: unknown): value is BoardMessage {
  if (typeof value !== "object" || value === null) return false;
  const { slug, state } = value as { slug?: unknown; state?: unknown };
  if (typeof slug !== "string") return false;
  if (typeof state !== "object" || state === null) return false;
  const s = state as Partial<AuctionState>;
  return (
    Array.isArray(s.players) &&
    s.players.length > 0 &&
    s.players.every((p) => typeof p?.name === "string" && typeof p?.budget === "number" && typeof p?.roster === "object" && p.roster !== null) &&
    Array.isArray(s.order) &&
    Array.isArray(s.history) &&
    typeof s.index === "number" &&
    typeof s.opener === "number" &&
    // Every phase, including the two the reel lives in - an overlay that
    // joins mid-spin has to be able to draw one.
    (s.phase === "ready" || s.phase === "spinning" || s.phase === "bidding" || s.phase === "assigning" || s.phase === "done")
  );
}
