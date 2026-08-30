"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { fetchLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { getPendingReferralCode, DISMISSED_REFERRAL_BANNER_KEY } from "@/lib/referralStorage";
import { reportError } from "@/lib/sentry";

type Referrer = { label: string; avatarUrl: string | null };

// In-flow (not an overlay) so it can stay up for the whole visit without
// permanently covering page content - persists until the visitor signs up,
// dismisses it, or the referral code turns out to be invalid, matching
// the "no auto-fade" call from when this was mocked up. Solid card
// background (not a translucent tint) since this sits sticky on top of
// picks scrolling underneath it - a see-through wash there just reads as
// illegible noise once real content is scrolling behind it.
export function ReferralBanner() {
  const { user } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const [referrer, setReferrer] = useState<Referrer | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // Hydration: localStorage does not exist on the server, so this
    // cannot move into the initialiser without the server and the client
    // rendering different HTML from the same markup. Starts true so the
    // banner never flashes before we know it was dismissed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(localStorage.getItem(DISMISSED_REFERRAL_BANNER_KEY) === "1");
  }, []);

  useEffect(() => {
    if (user || dismissed) return;
    const code = getPendingReferralCode();
    if (!code) {
      // No code means no referrer, which is a fact rather than a fetch -
      // so it is settled below at render instead of by a setState here.
      return;
    }
    fetchLeaderboardEntry(code)
      .then((row) => setReferrer(row ? { label: row.display_name || row.username, avatarUrl: row.avatar_url } : null))
      .catch((err) => {
        reportError("referral.banner", err);
        setReferrer(null);
      });
  }, [user, dismissed]);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_REFERRAL_BANNER_KEY, "1");
    setDismissed(true);
  }

  if (user || dismissed || !referrer) return null;

  return (
    <>
      <div className="sticky top-[72px] z-40 px-4 pt-3">
        <div
          role="button"
          tabIndex={0}
          onClick={() => requestSignIn()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              requestSignIn();
            }
          }}
          className="flex items-center gap-3 rounded-2xl border border-white/15 px-3.5 py-3 shadow-2xl shadow-black/40 cursor-pointer"
          style={{ background: "#0b1730" }}
        >
          {referrer.avatarUrl ? (
            <img src={referrer.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover shrink-0 border border-white/15" />
          ) : (
            <span
              className="h-11 w-11 rounded-full flex items-center justify-center text-base font-semibold text-white shrink-0"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              {referrer.label.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white font-medium truncate" style={{ fontFamily: "var(--font-display)" }}>
              {referrer.label} invited you
            </div>
            <div className="text-xs text-white/55 truncate mt-0.5">Sign up — you&rsquo;ll both earn 1,000 pts</div>
          </div>
          <span
            className="shrink-0 rounded-full px-4 py-2 text-xs"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            JOIN
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss();
            }}
            className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
      {signInModal}
    </>
  );
}
