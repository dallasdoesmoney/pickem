// Shared keys so useAuth (which claims the referral), the sign-in modal
// (which shows referral context while signing up), and the banner (which
// prompts signing up in the first place) all agree on where this lives.
export const PENDING_REFERRAL_KEY = "pickem:pending-referral";
export const DISMISSED_REFERRAL_BANNER_KEY = "pickem:referral-banner-dismissed";

export function getPendingReferralCode(): string | null {
  return localStorage.getItem(PENDING_REFERRAL_KEY);
}
