"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchMyReferrals, ReferralRow } from "@/lib/supabase/referrals";
import { errorMessage } from "@/lib/errorMessage";
import { FriendButton } from "@/components/FriendButton";

export function MyReferralsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [referrals, setReferrals] = useState<ReferralRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setReferrals(null);
    setError(null);
    fetchMyReferrals()
      .then(setReferrals)
      .catch((err) => setError(errorMessage(err)));
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
          {error && <p className="text-sm text-red-400 text-center mb-2">{error}</p>}

          {!referrals ? (
            <div className="flex justify-center py-10">
              <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-10 text-white/50">
              <div className="text-3xl mb-3">🎉</div>
              <p className="text-sm">Nobody's joined with your invite link yet.</p>
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
                  {r.user_id !== user.id && <FriendButton myId={user.id} otherId={r.user_id} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
