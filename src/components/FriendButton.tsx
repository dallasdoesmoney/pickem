"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import {
  fetchFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  FriendshipStatus,
} from "@/lib/supabase/friends";

// Small state machine covering every relationship two accounts can be
// in - no relationship, a request either side sent, or accepted friends.
// compact: a single-row, short-label rendering for tight list contexts
// (MyReferralsModal) - the full-size labels ("Request Sent · Cancel",
// "Accept Friend Request") are wide enough to force flex-1 name text in a
// narrow row down to just a couple characters before truncating.
export function FriendButton({
  myId,
  otherId,
  onChange,
  compact = false,
}: {
  myId: string;
  otherId: string;
  onChange?: () => void;
  compact?: boolean;
}) {
  const [relationship, setRelationship] = useState<FriendshipStatus | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    fetchFriendshipStatus(myId, otherId)
      .then(setRelationship)
      .catch(() => setRelationship(null));
  }

  useEffect(reload, [myId, otherId]);

  async function handleAdd() {
    setBusy(true);
    setError(null);
    const { error } = await sendFriendRequest(myId, otherId);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    reload();
    posthog.capture("friend_request_sent");
    onChange?.();
  }

  async function handleAccept() {
    if (!relationship) return;
    setBusy(true);
    setError(null);
    const { error } = await acceptFriendRequest(relationship.id);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    reload();
    posthog.capture("friend_request_accepted");
    onChange?.();
  }

  async function handleRemove() {
    if (!relationship) return;
    setBusy(true);
    setError(null);
    const { error } = await removeFriendship(relationship.id);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    reload();
    posthog.capture("friendship_removed", { previous_status: relationship.status });
    onChange?.();
  }

  if (relationship === undefined) return null;

  const buttonStyle = { fontFamily: "var(--font-display)" };
  const primaryStyle = { ...buttonStyle, background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" };
  const outlineClass = "border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors";

  if (compact) {
    const compactPill = "rounded-full px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50 shrink-0";
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        {relationship === null && (
          <button onClick={handleAdd} disabled={busy} className={`${compactPill} active:scale-95 transition-transform duration-150`} style={primaryStyle}>
            {busy ? "…" : "Add"}
          </button>
        )}

        {relationship?.status === "pending" && relationship.requester_id === myId && (
          <button onClick={handleRemove} disabled={busy} className={`${compactPill} ${outlineClass}`} style={buttonStyle}>
            {busy ? "…" : "Cancel"}
          </button>
        )}

        {relationship?.status === "pending" && relationship.addressee_id === myId && (
          <>
            <button onClick={handleAccept} disabled={busy} className={`${compactPill} active:scale-95 transition-transform duration-150`} style={primaryStyle}>
              {busy ? "…" : "Accept"}
            </button>
            <button
              onClick={handleRemove}
              disabled={busy}
              aria-label="Decline friend request"
              className="h-7 w-7 shrink-0 rounded-full border border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            </button>
          </>
        )}

        {relationship?.status === "accepted" && (
          <button onClick={handleRemove} disabled={busy} className={`${compactPill} ${outlineClass}`} style={buttonStyle}>
            {busy ? "…" : "✓ Friends"}
          </button>
        )}

        {error && <p className="text-[10px] text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      {relationship === null && (
        <button
          onClick={handleAdd}
          disabled={busy}
          className="rounded-full px-5 py-2 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50"
          style={primaryStyle}
        >
          {busy ? "…" : "Add Friend"}
        </button>
      )}

      {relationship?.status === "pending" && relationship.requester_id === myId && (
        <button onClick={handleRemove} disabled={busy} className={`rounded-full px-5 py-2 text-sm disabled:opacity-50 ${outlineClass}`} style={buttonStyle}>
          {busy ? "…" : "Request Sent · Cancel"}
        </button>
      )}

      {relationship?.status === "pending" && relationship.addressee_id === myId && (
        <div className="flex items-center gap-2">
          <button
            onClick={handleAccept}
            disabled={busy}
            className="rounded-full px-5 py-2 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50"
            style={primaryStyle}
          >
            {busy ? "…" : "Accept Friend Request"}
          </button>
          <button onClick={handleRemove} disabled={busy} className="text-xs text-white/40 hover:text-white/70 transition-colors">
            Decline
          </button>
        </div>
      )}

      {relationship?.status === "accepted" && (
        <button onClick={handleRemove} disabled={busy} className={`rounded-full px-5 py-2 text-sm disabled:opacity-50 ${outlineClass}`} style={buttonStyle}>
          {busy ? "…" : "✓ Friends · Remove"}
        </button>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
