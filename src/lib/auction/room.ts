import type { AuctionState } from "./engine";

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

// No 0/O/1/l/I - this gets read off a screen and typed by hand when
// something goes wrong at 8:59pm.
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
const CODE_LENGTH = 10;

export function newRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // Modulo bias over 31 symbols from a 256-value byte is about 3% on the
  // first nine symbols. At 10 characters that is ~48 bits either way; it
  // does not move the guessability of this in any way that matters.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export function isRoomCode(value: string): boolean {
  return value.length === CODE_LENGTH && [...value].every((c) => ALPHABET.includes(c));
}

export function roomChannel(code: string): string {
  return `versus:${code}`;
}

// WHOLE STATE, EVERY TIME - never a delta.
//
// A dropped or out-of-order broadcast then costs nothing: the next action
// overwrites everything and the overlay is correct again. Deltas would
// desync once and stay desynced for the rest of the draft, on stream,
// with no way to fix it short of reloading the source.
export type BoardMessage = { slug: string; state: AuctionState };

// The overlay says this when it joins. OBS reloads a browser source on
// every scene switch and restart, and a broadcast channel has no history,
// so without this a reloaded overlay would sit blank until the next bid.
export const HELLO = "hello";
export const STATE = "state";

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
    (s.phase === "bidding" || s.phase === "assigning" || s.phase === "done")
  );
}
