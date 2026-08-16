"use client";

import { useEffect, useState } from "react";
import {
  fetchFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  removeFriendship,
  FriendshipStatus,
} from "@/lib/supabase/friends";

// Small state machine covering every relationship two accounts can be
// in - no relationship, a request either side sent, or accepted friends.
export function FriendButton({ myId, otherId, onChange }: { myId: string; otherId: string; onChange?: () => void }) {
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
    onChange?.();
  }

  if (relationship === undefined) return null;

  const buttonStyle = { fontFamily: "var(--font-display)" };
  const primaryStyle = { ...buttonStyle, background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" };
  const outlineClass = "border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors";

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
