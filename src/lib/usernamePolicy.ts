import { containsBlockedWord } from "@/lib/moderation";

export const USERNAME_MIN = 4;
export const USERNAME_MAX = 20;

export type UsernameFormatCheck = { valid: boolean; reason?: string };

export function validateUsernameFormat(username: string): UsernameFormatCheck {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return { valid: false, reason: `${USERNAME_MIN}-${USERNAME_MAX} characters` };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return { valid: false, reason: "Letters, numbers, and underscores only" };
  }
  if (containsBlockedWord(username)) {
    return { valid: false, reason: "That username isn't allowed" };
  }
  return { valid: true };
}
