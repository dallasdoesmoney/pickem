import type { WavelengthState } from "./engine";
import { channelFor } from "@/lib/rooms";

export { newRoomCode, isRoomCode, HELLO, STATE } from "@/lib/rooms";

// Its own channel namespace, so a room code reused from a draft cannot
// put a Wavelength board on a Versus overlay - which drops every message
// and looks exactly like a dead room.
export function waveChannel(code: string): string {
  return channelFor("wavelength", code);
}

// WHOLE STATE, EVERY TIME - never a delta. A dropped or out-of-order
// broadcast then costs nothing: the next action overwrites everything and
// the overlay is correct again.
export type WaveMessage = { deck: string; state: WavelengthState };

// Anything at all can arrive on a channel, and the overlay is the one
// screen that must not throw - a crashed browser source is a black hole
// in the middle of a live stream. So nothing gets drawn until it has been
// checked, and a message that fails is dropped rather than rendered.
export function isWaveMessage(value: unknown): value is WaveMessage {
  if (typeof value !== "object" || value === null) return false;
  const { deck, state } = value as { deck?: unknown; state?: unknown };
  if (typeof deck !== "string") return false;
  if (typeof state !== "object" || state === null) return false;
  const s = state as Partial<WavelengthState>;
  return (
    (s.mode === "teams" || s.mode === "coop") &&
    typeof s.pot === "number" &&
    typeof s.runLength === "number" &&
    Array.isArray(s.teams) &&
    s.teams.length === 2 &&
    s.teams.every((t) => typeof t?.name === "string" && typeof t?.score === "number") &&
    typeof s.psychic === "number" &&
    typeof s.round === "number" &&
    typeof s.clue === "string" &&
    typeof s.card === "object" &&
    s.card !== null &&
    typeof s.card.left === "string" &&
    typeof s.card.right === "string" &&
    // The target is a number at the reveal and null before it. Both are
    // legal; anything else is not.
    (s.target === null || typeof s.target === "number") &&
    (s.guess === null || typeof s.guess === "number") &&
    (s.phase === "clue" || s.phase === "guess" || s.phase === "steal" || s.phase === "reveal" || s.phase === "done")
  );
}
