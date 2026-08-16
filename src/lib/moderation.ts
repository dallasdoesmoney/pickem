// Shared between username and display name validation, so the two never
// drift out of sync. Deliberately short and conservative - long/
// aggressive blocklists tend to false-positive on innocuous words (e.g.
// "cock" blocking "hancock"). This only catches the unambiguous cases.
// Client-side only; see the matching regex in supabase/schema.sql for the
// server-side backstop.
export const BLOCKED_SUBSTRINGS = ["fuck", "shit", "bitch", "asshole", "cunt", "nigger", "nigga", "faggot", "retard", "whore", "slut", "rape", "nazi", "hitler", "pussy"];

export function containsBlockedWord(text: string): boolean {
  const lower = text.toLowerCase();
  return BLOCKED_SUBSTRINGS.some((word) => lower.includes(word));
}
