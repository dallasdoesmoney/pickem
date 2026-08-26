// Shared keys so useAuth (which claims the referral), the sign-in modal
// (which shows referral context while signing up), and the banner (which
// prompts signing up in the first place) all agree on where this lives.
export const PENDING_REFERRAL_KEY = "pickem:pending-referral";
export const DISMISSED_REFERRAL_BANNER_KEY = "pickem:referral-banner-dismissed";

export function getPendingReferralCode(): string | null {
  return localStorage.getItem(PENDING_REFERRAL_KEY);
}

// Used in share text (picks/predictor images) and the invite card - a
// share with no username yet just links the plain site, since there's no
// code to attribute a signup to.
export function buildReferralLink(username: string | null | undefined): string {
  return username ? `${window.location.origin}/?ref=${username}` : window.location.origin;
}

// The same link, pointed at a page rather than the front door.
//
// A result posted from the daily game should land whoever taps it ON the
// daily game - sending them to the home page to go and find it loses most
// of them on the way. Attribution still works from anywhere: useAuth
// reads ?ref= off window.location.search on whatever page it first sees,
// not just "/".
//
// Absolute, always. A share is read somewhere this site is not, so a
// relative path is not a link at all - and a share sheet will only unfurl
// something it can recognise as a URL.
export function buildReferralLinkTo(path: string, username: string | null | undefined): string {
  const base = `${window.location.origin}${path}`;
  return username ? `${base}?ref=${username}` : base;
}
