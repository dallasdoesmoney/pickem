"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { sendFriendRequest } from "@/lib/supabase/friends";

// The post-signup counterpart to ReferralBanner - same card shape, but
// this one needs an action button (Add Friend) rather than just an
// auto-dismiss message, so it's a plain ambient component like
// ReferralBanner, not part of the NotificationToasts queue. Naturally
// one-shot already: useAuth only ever populates pendingReferrerSuggestion
// on the single session load right after signup (see useAuth.tsx).
export function ReferrerSuggestionCard() {
  const { user, pendingReferrerSuggestion, clearPendingReferrerSuggestion } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (!user || !pendingReferrerSuggestion) return null;

  async function handleAdd() {
    if (!user || !pendingReferrerSuggestion) return;
    setSending(true);
    const { error } = await sendFriendRequest(user.id, pendingReferrerSuggestion.userId);
    setSending(false);
    if (!error) setSent(true);
    setTimeout(() => clearPendingReferrerSuggestion(), error ? 0 : 1500);
  }

  return (
    <div className="sticky top-[72px] z-40 px-4 pt-3">
      <div className="flex items-center gap-3 rounded-2xl border border-white/15 px-3.5 py-3 shadow-2xl shadow-black/40" style={{ background: "#0b1730" }}>
        {pendingReferrerSuggestion.avatarUrl ? (
          <img src={pendingReferrerSuggestion.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover shrink-0 border border-white/15" />
        ) : (
          <span
            className="h-11 w-11 rounded-full flex items-center justify-center text-base font-semibold text-white shrink-0"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          >
            {pendingReferrerSuggestion.label.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate" style={{ fontFamily: "var(--font-display)" }}>
            {pendingReferrerSuggestion.label} invited you
          </div>
          <div className="text-xs text-white/55 truncate mt-0.5">Add them as a friend to compare picks</div>
        </div>
        {sent ? (
          <span className="shrink-0 text-xs text-emerald-300" style={{ fontFamily: "var(--font-display)" }}>
            SENT
          </span>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            disabled={sending}
            className="shrink-0 rounded-full px-4 py-2 text-xs active:scale-95 transition-transform duration-150 disabled:opacity-60"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            {sending ? "…" : "ADD FRIEND"}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => clearPendingReferrerSuggestion()}
          className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
