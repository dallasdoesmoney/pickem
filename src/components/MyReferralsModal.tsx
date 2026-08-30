"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyReferrals, ReferralRow } from "@/lib/supabase/referrals";
import { buildReferralLink } from "@/lib/referralStorage";
import { errorMessage } from "@/lib/errorMessage";
import { FollowButton } from "@/components/FollowButton";

export function MyReferralsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, profile } = useAuth();
  const [referrals, setReferrals] = useState<ReferralRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const link = profile?.username ? buildReferralLink(profile.username) : null;

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    posthog.capture("referral_link_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!link) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Sideline Brew", text: "Come make some picks with me on Sideline Brew!", url: link });
        posthog.capture("referral_link_shared", { share_method: "native_share" });
      } catch {
        // User canceled or share failed - nothing to recover, same as elsewhere this pattern is used.
      }
    } else {
      handleCopy();
    }
  }

  function load() {
    setReferrals(null);
    setError(null);
    fetchMyReferrals()
      .then(setReferrals)
      .catch((err) => {
        console.error("Failed to load referrals", errorMessage(err));
        setError("Couldn't load your referrals.");
      });
  }

  // The fetch without the reset - see load() above, which keeps its
  // resets because the retry button calls it from an event handler where
  // a setState is exactly right. On the way in there is nothing to
  // reset: the initial state is already the loading state.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchMyReferrals()
      .then((rows) => {
        if (!cancelled) setReferrals(rows);
      })
      .catch((err) => {
        console.error("Failed to load referrals", errorMessage(err));
        if (!cancelled) setError("Couldn't load your referrals.");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open || !user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            MY REFERRALS
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 flex flex-col gap-3">
          {link && (
            <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 p-3 shrink-0">
              <div className="text-xs text-white/60 truncate">{link}</div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex-1 rounded-full px-4 py-2 text-xs border border-white/15 hover:border-white/30 text-white/80 hover:text-white transition-colors"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {copied ? "COPIED" : "COPY LINK"}
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex-1 rounded-full px-4 py-2 text-xs active:scale-95 transition-transform duration-150"
                  style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
                >
                  SHARE
                </button>
              </div>
            </div>
          )}
          {error ? (
            <div className="text-center py-10">
              <p className="text-sm text-red-400 mb-3">{error}</p>
              <button
                type="button"
                onClick={load}
                className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/70 hover:text-white hover:border-white/30 transition-colors"
              >
                Try again
              </button>
            </div>
          ) : !referrals ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-10 text-white/50">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-sm">Nobody&rsquo;s joined with your invite link yet.</p>
            </div>
          ) : (
            referrals.map((r) => {
              const label = r.display_name || r.username || "New player";
              return (
                <div key={r.user_id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <span className="h-9 w-9 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">{label.charAt(0).toUpperCase()}</span>
                  )}
                  <span className="flex-1 min-w-0 text-sm truncate">{label}</span>
                  {r.user_id !== user.id && <FollowButton myId={user.id} otherId={r.user_id} compact />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
