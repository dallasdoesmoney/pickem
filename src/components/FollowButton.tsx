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

  const onClick = status.iFollow ? handleUnfollow : handleFollow;

  // Follow is the only real "do something new" call to action, so it
  // keeps the bold gradient CTA treatment. The other three are status
  // pills, not calls to action - each gets its own color so the three
  // are distinguishable at a glance in a list: sky = you're following
  // them (one-directional out), purple = they're following you and
  // it's on you to follow back (one-directional in, needs a decision),
  // emerald = mutual/complete, matching the color already used for
  // "done" states elsewhere (achievements, level-ups).
  const kind = status.iFollow && status.followsMe ? "friends" : status.iFollow ? "following" : status.followsMe ? "followBack" : "follow";
  const label = kind === "friends" ? "✓ Friends" : kind === "following" ? "Following" : kind === "followBack" ? "Follow Back" : "Follow";

  const fontStyle = { fontFamily: "var(--font-display)" };
  const KIND_STYLE: Record<typeof kind, { className: string; style: React.CSSProperties }> = {
    follow: {
      className: "active:scale-95 transition-transform duration-150",
      style: { ...fontStyle, background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" },
    },
    following: {
      className: "border transition-colors hover:brightness-110",
      style: { ...fontStyle, background: "rgba(56,189,248,0.14)", borderColor: "rgba(56,189,248,0.4)", color: "#7dd3fc" },
    },
    followBack: {
      className: "border transition-colors hover:brightness-110",
      style: { ...fontStyle, background: "rgba(192,132,252,0.14)", borderColor: "rgba(192,132,252,0.4)", color: "#d8b4fe" },
    },
    friends: {
      className: "border transition-colors hover:brightness-110",
      style: { ...fontStyle, background: "rgba(74,222,128,0.14)", borderColor: "rgba(74,222,128,0.4)", color: "#86efac" },
    },
  };
  const { className: kindClassName, style: kindStyle } = KIND_STYLE[kind];

  if (compact) {
    const compactPill = "rounded-full px-3 py-1.5 text-xs whitespace-nowrap disabled:opacity-50 shrink-0";
    return (
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={onClick} disabled={busy} className={`${compactPill} ${kindClassName}`} style={kindStyle}>
          {busy ? "…" : label}
        </button>
        {error && <p className="text-[10px] text-red-400">{error}</p>}
        {signInModal}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button onClick={onClick} disabled={busy} className={`rounded-full px-5 py-2 text-sm disabled:opacity-50 ${kindClassName}`} style={kindStyle}>
        {busy ? "…" : label}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {signInModal}
    </div>
  );
}
