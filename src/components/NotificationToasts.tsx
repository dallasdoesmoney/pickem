"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadNotifications, markNotificationRead, syncLevelUpNotifications, NotificationRow } from "@/lib/supabase/notifications";
import { dailyCheckIn } from "@/lib/supabase/checkIn";
import { fetchMyReferrals, ReferralRow } from "@/lib/supabase/referrals";
import { fetchProfilesByIds, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { ALL_LEVELS, subLevelRoman } from "@/lib/levels";
import { activityHref } from "@/lib/activity";

type Actor = Pick<LeaderboardRow, "username" | "display_name" | "avatar_url">;

const TOAST_DURATION_MS = 5000;

type ToastContent = {
  avatarUrl: string | null;
  initial: string;
  title: string;
  subtitle: string;
  accentColor: string;
  // Where tapping it goes. Same helper the activity feed uses, so a
  // toast and the feed row for the same event land in the same place.
  href: string;
};

// A check-in toast is made here rather than written to notifications:
// it fires every single day, and a row a day would bury the activity
// feed under the one thing nobody needs a record of. The "local:" prefix
// marks it as having no database row, so dismissing it does not try to
// mark one read.
const LOCAL_ID = "local:";
function checkInToast(points: number, streak: number): NotificationRow {
  return {
    id: `${LOCAL_ID}check-in`,
    type: "daily_check_in" as NotificationRow["type"],
    data: { points, streak },
    created_at: new Date().toISOString(),
  };
}

function buildToastContent(n: NotificationRow, referrals: ReferralRow[], actors: Map<string, Actor>): ToastContent {
  if (n.type === ("daily_check_in" as NotificationRow["type"])) {
    const streak = Number(n.data.streak);
    return {
      avatarUrl: null,
      initial: "\u{1F525}",
      title: `+${Number(n.data.points)} for checking in`,
      subtitle: streak > 1 ? `${streak} days in a row` : "Come back tomorrow to start a streak",
      accentColor: "#fb923c",
      href: "/account",
    };
  }

  if (n.type === "new_follower") {
    const follower = actors.get(String(n.data.follower_id));
    const label = follower?.display_name || follower?.username || "Someone";
    const isMutual = n.data.is_mutual === true;
    return {
      avatarUrl: follower?.avatar_url ?? null,
      initial: label.charAt(0).toUpperCase(),
      title: isMutual ? `${label} followed you back — you're now friends!` : `${label} started following you`,
      subtitle: isMutual ? "You're now friends" : "Tap to view their profile",
      accentColor: isMutual ? "#4ade80" : "#c084fc",
      href: activityHref("new_follower", follower?.username) ?? "/notifications",
    };
  }

  if (n.type === "level_up") {
    const level = Number(n.data.level);
    const entry = ALL_LEVELS[level - 1];
    if (!entry)
      return { avatarUrl: null, initial: "🎉", title: "You leveled up!", subtitle: `Level ${level}`, accentColor: "#4ade80", href: "/account" };
    return {
      avatarUrl: null,
      initial: entry.rankEmoji,
      title: `Level ${entry.level} — ${entry.rankName} ${subLevelRoman(entry.subLevel)}`,
      subtitle: "You leveled up!",
      accentColor: entry.rankColor,
      href: activityHref("level_up"),
    };
  }

  if (n.type === "creator_request_approved") {
    return {
      avatarUrl: null,
      initial: "🎥",
      title: "You're now a Creator!",
      subtitle: "Your badge is live on your profile",
      accentColor: "#ef4444",
      href: activityHref("creator_request_approved"),
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
    href: activityHref("referral_joined", referee?.username) ?? "/notifications",
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
    // Check in first, then sync levels: the 50 points can be what tips
    // someone over a level, and doing it the other way round would hold
    // that notification back until the next load.
    dailyCheckIn()
      .then((result) => {
        if (!cancelled && result.awarded) {
          setQueue((q) => [checkInToast(result.points, result.streak), ...q]);
        }
      })
      .catch((err) => console.error("Daily check-in failed", err))
      .then(() => syncLevelUpNotifications())
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

  function clear(n: NotificationRow) {
    // Synthetic toasts have no row to mark read.
    if (!n.id.startsWith(LOCAL_ID)) {
      markNotificationRead(n.id).catch((err) => console.error("Failed to mark notification read", err));
    }
    setCurrent(null);
  }

  function dismiss(e?: React.MouseEvent | React.KeyboardEvent) {
    e?.stopPropagation();
    if (!current) return;
    clear(current);
  }

  // Tapping anywhere on the toast (besides the dismiss button) goes to
  // whatever the toast is actually about - the person who followed you,
  // or your own profile for a level-up. It used to go to the activity
  // feed regardless, which meant a toast naming someone couldn't take
  // you to them. The feed is still the fallback when an actor's profile
  // hasn't resolved.
  function handleOpen() {
    if (!current) return;
    const target = buildToastContent(current, referrals, actors).href;
    clear(current);
    router.push(target);
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
