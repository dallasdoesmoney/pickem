import { containsBlockedWord } from "@/lib/moderation";

export const DISPLAY_NAME_MAX = 30;

export type DisplayNameCheck = { valid: boolean; reason?: string };

// Unlike username, this isn't a unique identifier - just what shows on
// the leaderboard - so no format restriction beyond a length cap and the
// same profanity backstop.
export function validateDisplayName(name: string): DisplayNameCheck {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { valid: false, reason: "Can't be empty" };
  if (trimmed.length > DISPLAY_NAME_MAX) return { valid: false, reason: `${DISPLAY_NAME_MAX} characters max` };
  if (containsBlockedWord(trimmed)) return { valid: false, reason: "That name isn't allowed" };
  return { valid: true };
}
