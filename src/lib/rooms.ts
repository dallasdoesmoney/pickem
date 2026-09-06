// THE ROOM, for any game that has a board and an overlay.
//
// Versus had all of this to itself. Wavelength needs exactly the same
// thing - a code, a channel, a hello, a whole-state message - so it moved
// here rather than being written a second time. What stayed behind in
// each game is the part that is actually about that game: what a valid
// state looks like, and what the overlay is allowed to see.
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

// THE GAME IS PART OF THE CHANNEL NAME, and it has to be: somebody who
// reuses a room code across two games would otherwise have a Wavelength
// board broadcasting into a Versus overlay, which drops every message and
// looks exactly like a dead room.
//
// "versus" is spelled the way it always was, so an OBS source that has
// been sitting in a scene collection since before this file existed keeps
// working.
export function channelFor(game: string, code: string): string {
  return `${game}:${code}`;
}

// The overlay says HELLO when it joins. OBS reloads a browser source on
// every scene switch and restart, and a broadcast channel has no history,
// so without this a reloaded overlay would sit blank until the next move.
export const HELLO = "hello";
export const STATE = "state";
