"use client";

import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { fetchFollowStatus, followUser, unfollowUser, FollowStatus } from "@/lib/supabase/follows";
import { useSignInModal } from "@/hooks/useSignInModal";

// Four states, derived from {iFollow, followsMe} - no more pending/accept
// dance, every action is a single instant button. compact: a single-row,
// short-label rendering for tight list contexts (MyReferralsModal).
//
// myId is optional deliberately: signed-out visitors should still see
// the Follow button (so the ability is always visible, not hidden until
// you're signed in), it just always reads as the base "Follow" state and
// clicking it opens the sign-in modal instead of calling the API.
//
// Clicking "Friends" only removes YOUR outgoing edge - if they still
// follow you, it drops to "Follow Back," not all the way back to
// "Follow." That's the correct Twitter-style semantic (unfollowing isn't
// symmetric the way the old "Remove" was), not a bug.
export function FollowButton({
  myId,
  otherId,
  onChange,
  compact = false,
}: {
  myId?: string;
  otherId: string;
  onChange?: () => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<FollowStatus | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { requestSignIn, signInModal } = useSignInModal();

  function reload() {
    if (!myId) {
      setStatus({ iFollow: false, followsMe: false });
      return;
    }
    fetchFollowStatus(myId, otherId)
      .then(setStatus)
      .catch(() => setStatus({ iFollow: false, followsMe: false }));
  }

  useEffect(reload, [myId, otherId]);

  async function handleFollow() {
    if (!myId) {
      await requestSignIn();
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await followUser(myId, otherId);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    posthog.capture("follow_started");
    reload();
    onChange?.();
  }

  async function handleUnfollow() {
    if (!myId) return;
    setBusy(true);
    setError(null);
    const { error } = await unfollowUser(myId, otherId);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    posthog.capture("follow_removed");
    reload();
    onChange?.();
  }

  if (status === undefined) return null;

  const buttonStyle = { fontFamily: "var(--font-display)" };
  const primaryStyle = { ...buttonStyle, background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" };
  const outlineClass = "border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors";

  const label = status.iFollow && status.followsMe ? "✓ Friends" : status.iFollow ? "Following" : status.followsMe ? "Follow Back" : "Follow";
  const isPrimary = !status.iFollow; // Follow / Follow Back are the "do something" actions; Following / Friends are outline
  const onClick = status.iFollow ? handleUnfollow : handleFollow;

  if (compact) {
    const compactPill = "rounded-full px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50 shrink-0";
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onClick}
          disabled={busy}
          className={`${compactPill} ${isPrimary ? "active:scale-95 transition-transform duration-150" : outlineClass}`}
          style={isPrimary ? primaryStyle : buttonStyle}
        >
          {busy ? "…" : label}
        </button>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
        {signInModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        onClick={onClick}
        disabled={busy}
        className={`rounded-full px-5 py-2 text-sm disabled:opacity-50 ${isPrimary ? "active:scale-95 transition-transform duration-150" : outlineClass}`}
        style={isPrimary ? primaryStyle : buttonStyle}
      >
        {busy ? "…" : label}
      </button>
      {status.followsMe && !status.iFollow && <p className="text-[10px] text-white/40">Follows you</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {signInModal}
    </div>
  );
}
