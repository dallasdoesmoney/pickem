export const USERNAME_MIN = 4;
export const USERNAME_MAX = 20;

// Deliberately short and conservative - long/aggressive blocklists tend to
// false-positive on innocuous names (e.g. "cock" blocking "hancock"). This
// only catches the unambiguous cases. Client-side only; see the matching
// regex in supabase/schema.sql for the server-side backstop.
const BLOCKED_SUBSTRINGS = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga", "faggot", "retard", "whore", "slut", "rape", "nazi", "hitler", "pussy"];

export type UsernameFormatCheck = { valid: boolean; reason?: string };

export function validateUsernameFormat(username: string): UsernameFormatCheck {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { valid: false, reason: `${USERNAME_MIN}-${USERNAME_MAX} characters` };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, reason: "Letters, numbers, and underscores only" };
  }
  const lower = username.toLowerCase();
  if (BLOCKED_SUBSTRINGS.some((word) => lower.includes(word))) {
    return { valid: false, reason: "That username isn't allowed" };
  }
  return { valid: true };
}
