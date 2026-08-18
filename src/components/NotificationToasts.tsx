"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadNotifications, markNotificationRead, syncLevelUpNotifications, NotificationRow } from "@/lib/supabase/notifications";
import { fetchMyReferrals, ReferralRow } from "@/lib/supabase/referrals";
import { fetchProfilesByIds, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { ALL_LEVELS, subLevelRoman } from "@/lib/levels";

type Actor = Pick<LeaderboardRow, "username" | "display_name" | "avatar_url">;

const TOAST_DURATION_MS = 5000;

type ToastContent = {
  avatarUrl: string | null;
  initial: string;
  title: string;
  subtitle: string;
  accentColor: string;
};

function buildToastContent(n: NotificationRow, referrals: ReferralRow[], actors: Map<string, Actor>): ToastContent {
  if (n.type === "new_follower") {
    const follower = actors.get(String(n.data.follower_id));
    const label = follower?.display_name || follower?.username || "Someone";
    const isMutual = n.data.is_mutual === true;
    return {
      avatarUrl: follower?.avatar_url ?? null,
      initial: label.charAt(0).toUpperCase(),
      title: isMutual ? `${label} followed you back — you're now friends!` : `${label} started following you`,
      subtitle: isMutual ? "You're now friends" : "Tap to view",
      accentColor: isMutual ? "#4ade80" : "#c084fc",
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

  // referral_joined
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

// Ambient, self-mounted (same shape as ReferralBanner) rather than a
// useX() hook - there's no imperative caller here, just a passive feed
// that shows itself whenever unread notifications exist. Deliberately
// keyed on profile?.referred_by (not just user) so a level-up caused by
// the referral bonus that lands in the same session as claim_referral
// isn't missed until the next load.
export function NotificationToasts() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [queue, setQueue] = useState<NotificationRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [actors, setActors] = useState<Map<string, Actor>>(new Map());
  const [current, setCurrent] = useState<NotificationRow | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    syncLevelUpNotifications()
      .catch((err) => console.error("Level-up sync failed", err))
      .finally(() => {
        if (cancelled) return;
        Promise.all([fetchUnreadNotifications(user.id).catch(() => []), fetchMyReferrals().catch(() => [])]).then(([notifications, myReferrals]) => {
          if (cancelled) return;
          setReferrals(myReferrals);
          setQueue(notifications);
          const actorIds = notifications.filter((n) => n.type === "new_follower").map((n) => String(n.data.follower_id));
          if (actorIds.length > 0) {
            fetchProfilesByIds(actorIds)
              .then(setActors)
              .catch((err) => console.error("Failed to resolve follower profiles", err));
          }
        });
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

  function dismiss(e?: React.MouseEvent | React.KeyboardEvent) {
    e?.stopPropagation();
    if (!current) return;
    markNotificationRead(current.id).catch((err) => console.error("Failed to mark notification read", err));
    setCurrent(null);
  }

  // Tapping anywhere on the toast (besides the dismiss button) takes you
  // to the notifications/activity page - same "mark read" as a plain
  // dismiss, just followed by navigating there instead of staying put.
  function handleOpen() {
    if (!current) return;
    markNotificationRead(current.id).catch((err) => console.error("Failed to mark notification read", err));
    setCurrent(null);
    router.push("/notifications");
  }

  if (!current) return null;

  const content = buildToastContent(current, referrals, actors);

  return (
    <div className="fixed top-[84px] left-1/2 -translate-x-1/2 z-[70] w-full max-w-sm px-4">
      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
        className="flex items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-2xl shadow-black/40 cursor-pointer transition-[filter] hover:brightness-110"
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
