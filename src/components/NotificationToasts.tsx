"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadNotifications, markNotificationRead, syncLevelUpNotifications, NotificationRow } from "@/lib/supabase/notifications";
import { fetchIncomingRequests, FriendRequest } from "@/lib/supabase/friends";
import { fetchMyReferrals, ReferralRow } from "@/lib/supabase/referrals";
import { fetchProfilesByIds, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { ALL_LEVELS, subLevelRoman } from "@/lib/levels";

type Accepter = Pick<LeaderboardRow, "username" | "display_name" | "avatar_url">;

const TOAST_DURATION_MS = 5000;

type ToastContent = {
  avatarUrl: string | null;
  initial: string;
  title: string;
  subtitle: string;
  accentColor: string;
};

function buildToastContent(n: NotificationRow, requests: FriendRequest[], referrals: ReferralRow[], accepters: Map<string, Accepter>): ToastContent {
  if (n.type === "friend_accepted") {
    const accepter = accepters.get(String(n.data.accepter_id));
    const label = accepter?.display_name || accepter?.username || "Someone";
    return {
      avatarUrl: accepter?.avatar_url ?? null,
      initial: label.charAt(0).toUpperCase(),
      title: `${label} accepted your friend request`,
      subtitle: "You're now friends",
      accentColor: "#4ade80",
    };
  }

  if (n.type === "level_up") {
    const level = Number(n.data.level);
    const entry = ALL_LEVELS[level - 1];
    if (!entry) return { avatarUrl: null, initial: "🎉", title: "You leveled up!", subtitle: `Level ${level}`, accentColor: "#4ade80" };
    return {
      avatarUrl: null,
      initial: entry.rankEmoji,
      title: `Level ${entry.level} — ${entry.rankName} ${subLevelRoman(entry.subLevel)}`,
      subtitle: "You leveled up!",
      accentColor: entry.rankColor,
    };
  }

  if (n.type === "referral_joined") {
    const referee = referrals.find((r) => r.user_id === n.data.referee_id);
    const label = referee?.display_name || referee?.username || "Someone";
    return {
      avatarUrl: referee?.avatar_url ?? null,
      initial: label.charAt(0).toUpperCase(),
      title: `${label} joined using your invite!`,
      subtitle: "You both earned 1,000 pts",
      accentColor: "#4ade80",
    };
  }

  // friend_request - the requester may not be in fetchIncomingRequests if
  // they don't have a username yet (same blind spot /notifications
  // already has today) - fall back to generic copy rather than dropping
  // the toast entirely.
  const req = requests.find((r) => r.requester_id === n.data.requester_id);
  const label = req?.display_name || req?.username;
  return {
    avatarUrl: req?.avatar_url ?? null,
    initial: (label ?? "?").charAt(0).toUpperCase(),
    title: label ? `${label} sent you a friend request` : "Someone sent you a friend request",
    subtitle: "Tap to view",
    accentColor: "#7c3aed",
  };
}

// Ambient, self-mounted (same shape as ReferralBanner) rather than a
// useX() hook - there's no imperative caller here, just a passive feed
// that shows itself whenever unread notifications exist. Deliberately
// keyed on profile?.referred_by (not just user) so a level-up caused by
// the referral bonus that lands in the same session as claim_referral
// isn't missed until the next load.
export function NotificationToasts() {
  const { user, profile } = useAuth();
  const [queue, setQueue] = useState<NotificationRow[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [accepters, setAccepters] = useState<Map<string, Accepter>>(new Map());
  const [current, setCurrent] = useState<NotificationRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    syncLevelUpNotifications()
      .catch((err) => console.error("Level-up sync failed", err))
      .finally(() => {
        if (cancelled) return;
        Promise.all([fetchUnreadNotifications(user.id).catch(() => []), fetchIncomingRequests(user.id).catch(() => []), fetchMyReferrals().catch(() => [])]).then(
          ([notifications, incoming, myReferrals]) => {
            if (cancelled) return;
            setRequests(incoming);
            setReferrals(myReferrals);
            setQueue(notifications);
            const accepterIds = notifications.filter((n) => n.type === "friend_accepted").map((n) => String(n.data.accepter_id));
            if (accepterIds.length > 0) {
              fetchProfilesByIds(accepterIds)
                .then(setAccepters)
                .catch((err) => console.error("Failed to resolve accepter profiles", err));
            }
          }
        );
      });
    return () => {
      cancelled = true;
    };
  }, [user, profile?.referred_by]);

  useEffect(() => {
    if (current || queue.length === 0) return;
    const [next, ...rest] = queue;
    setCurrent(next);
    setQueue(rest);
  }, [queue, current]);

  useEffect(() => {
    if (!current) return;
    const timer = setTimeout(dismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  function dismiss() {
    if (!current) return;
    markNotificationRead(current.id).catch((err) => console.error("Failed to mark notification read", err));
    setCurrent(null);
  }

  if (!current) return null;

  const content = buildToastContent(current, requests, referrals, accepters);

  return (
    <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-[70] w-full max-w-sm px-4">
      <div
        className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-2xl shadow-black/40"
        style={{ background: "#0b1730", borderColor: `${content.accentColor}55` }}
      >
        {content.avatarUrl ? (
          <img src={content.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover shrink-0 border border-white/15" />
        ) : (
          <span
            className="h-11 w-11 rounded-full flex items-center justify-center text-xl shrink-0"
            style={{ background: `${content.accentColor}26`, boxShadow: `0 0 16px -4px ${content.accentColor}` }}
          >
            {content.initial}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white font-medium truncate" style={{ fontFamily: "var(--font-display)" }}>
            {content.title}
          </div>
          <div className="text-xs text-white/55 truncate mt-0.5">{content.subtitle}</div>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
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
