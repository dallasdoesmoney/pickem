"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { fetchLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { getPendingReferralCode, DISMISSED_REFERRAL_BANNER_KEY } from "@/lib/referralStorage";

// In-flow (not an overlay) so it can stay up for the whole visit without
// permanently covering page content - persists until the visitor signs up,
// dismisses it, or the referral code turns out to be invalid, matching
// the "no auto-fade" call from when this was mocked up.
export function ReferralBanner() {
  const { user } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const [referrer, setReferrer] = useState<{ label: string } | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISSED_REFERRAL_BANNER_KEY) === "1");
  }, []);

  useEffect(() => {
    if (user || dismissed) return;
    const code = getPendingReferralCode();
    if (!code) {
      setReferrer(null);
      return;
    }
    fetchLeaderboardEntry(code)
      .then((row) => setReferrer(row ? { label: row.display_name || row.username } : null))
      .catch(() => setReferrer(null));
  }, [user, dismissed]);

  function handleDismiss() {
    localStorage.setItem(DISMISSED_REFERRAL_BANNER_KEY, "1");
    setDismissed(true);
  }

  if (user || dismissed || !referrer) return null;

  return (
    <>
      <div className="sticky top-[72px] z-40 flex items-center gap-3 px-4 py-2.5 bg-emerald-400/10 border-b border-emerald-400/25">
        <span className="text-lg shrink-0">🎉</span>
        <div className="flex-1 min-w-0 text-xs leading-tight">
          <div className="text-white font-medium truncate">{referrer.label} invited you</div>
          <div className="text-white/55 truncate">Sign up — you&rsquo;ll both earn 1,000 pts</div>
        </div>
        <button
          type="button"
          onClick={() => requestSignIn()}
          className="shrink-0 rounded-full px-4 py-1.5 text-xs active:scale-95 transition-transform duration-150"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
        >
          JOIN
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={handleDismiss}
          className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </div>
      {signInModal}
    </>
  );
}
