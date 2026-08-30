"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreadNotifications, markNotificationRead, syncLevelUpNotifications, NotificationRow } from "@/lib/supabase/notifications";
import { dailyCheckIn, CheckInResult } from "@/lib/supabase/checkIn";
import { StreakRenewedModal } from "@/components/StreakRenewedModal";
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
  // Set only by the check-in toast. Present means "draw the mark as the
  // pop-up's flame with this number counting up on it" instead of as a
  // static emoji - see the streak block in the render below.
  streak?: number;
};

// Titles are written to the column they have to fit in, which is 224px:
// 352px of card, less the 44px mark, the 28px dismiss button, two 12px
// gaps and 28px of padding. Measured in Bungee, which is wide - the same
// strings in the fallback face measure about 30% narrower and fit, which
// is exactly how they shipped truncated in the first place.
//
// The rule that keeps them short is that a title must not say what the
// subtitle underneath it already says. "Marcus followed you back - you're
// now friends!" wanted 409px and got cut to "Marcus followed you ba...",
// throwing away the half that carried the news, while the subtitle sat
// underneath saying "You're now friends" in full.

// Embers, laid out on a circle - the same construction as EMBERS in
// StreakRenewedModal, at a third the radius because this flame is 26px
// rather than 92px. Fixed rather than random for the same reason it is
// there: Math.random() here would reshuffle them on every paint and
// restart the animation.
const TOAST_EMBERS = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2 + 0.4;
  const distance = 26 + (i % 3) * 9;
  return {
    x: Math.round(Math.cos(angle) * distance),
    // Biased upward: embers rise.
    y: Math.round(Math.sin(angle) * distance - 10),
    delay: 240 + i * 34,
    hot: i % 2 === 1,
  };
});

// A check-in toast is made here rather than written to notifications:
// it fires every single day, and a row a day would bury the activity
// feed under the one thing nobody needs a record of. The "local:" prefix
// marks it as having no database row, so dismissing it does not try to
// mark one read.
const LOCAL_ID = "local:";

// The check-in dressed as a notification row so it can ride the same
// queue as everything else - one toast at a time, five seconds, same
// dismiss. `id` carries the LOCAL_ID prefix so clear() knows there is no
// database row to mark read; dismissing this must not fire a write for a
// row that does not exist.
function checkInRow(result: CheckInResult): NotificationRow {
  return {
    id: `${LOCAL_ID}check-in`,
    type: "daily_check_in" as NotificationRow["type"],
    data: { points: result.points, streak: result.streak, longest: result.longest },
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
      streak,
    };
  }

  if (n.type === "new_follower") {
    const follower = actors.get(String(n.data.follower_id));
    const label = follower?.display_name || follower?.username || "Someone";
    const isMutual = n.data.is_mutual === true;
    return {
      avatarUrl: follower?.avatar_url ?? null,
      initial: label.charAt(0).toUpperCase(),
      // Neither of these repeats its own subtitle. "started following"
      // was 257px on its own before any name was added to it, so the
      // shorter verb is what buys the room for a long display name.
      title: isMutual ? `${label} followed you back` : `${label} followed you`,
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
    title: `${label} used your invite`,
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
  const [checkIn, setCheckIn] = useState<CheckInResult | null>(null);
  const [actors, setActors] = useState<Map<string, Actor>>(new Map());
  const [checkInToast, setCheckInToast] = useState<NotificationRow | null>(null);

  // THE CHECK-IN, ON ITS OWN, CLAIMED ONCE. It used to live in the effect
  // below, which is keyed on profile?.referred_by - and useAuth delivers
  // `user` on one render and `profile` on a later one (it sets the user,
  // then awaits fetchProfile). So that effect ran TWICE on every load,
  // and the two runs fought over a thing that can only happen once a day:
  //
  //   call #1  awarded:true   <- won it, then discarded, because the
  //                              re-run had already set cancelled
  //   call #2  awarded:false  <- the day was already claimed
  //
  // Nothing was shown. The points still landed and the streak still
  // counted up, so the only broken part was the announcement - which is
  // why it looked like the notification had never been built.
  //
  // Keyed on `user` alone, because that is all a check-in depends on. The
  // ref holds the PROMISE rather than a done flag so a second run reuses
  // the in-flight claim instead of making a second one, and every run
  // subscribes to it - a re-render must not be able to drop a result the
  // previous run started waiting for.
  const checkInRef = useRef<{ userId: string; promise: Promise<CheckInResult | null> } | null>(null);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    if (checkInRef.current?.userId !== user.id) {
      checkInRef.current = {
        userId: user.id,
        promise: dailyCheckIn().catch((err) => {
          console.error("Daily check-in failed", err);
          return null;
        }),
      };
    }
    checkInRef.current.promise.then((result) => {
      if (cancelled || !result?.awarded) return;
      // Which surface depends on which day it is.
      //
      // A streak at 1 is a streak STARTING - someone's first ever, or the
      // first day back after one broke. That is the day with something to
      // announce that five seconds in the corner cannot carry: there is
      // no number counting up yet, just the fact that they came back, and
      // the day after a broken streak is exactly when somebody needs a
      // reason to keep going. So it gets the pop-up.
      //
      // From day two the count IS the story, and the count fits in the
      // bar - with the same flame on it, so it still reads as the same
      // event. A full-screen interrupt every single day stops being a
      // celebration and starts being a door to close.
      if (result.streak <= 1) setCheckIn(result);
      else setCheckInToast(checkInRow(result));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Still after the check-in, which is why the effect above is declared
    // first: the 50 points can be what tips someone over a level, and
    // syncing levels before the check-in lands would hold that level-up
    // notification back until the next load. Awaiting the same promise
    // keeps that order without calling daily_check_in() a second time.
    (checkInRef.current?.promise ?? Promise.resolve(null))
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

  // Which toast is on screen is a QUESTION ABOUT THE QUEUE, not a third
  // piece of state that has to be kept in step with it. It used to be an
  // effect that pulled the head off the queue into `current`, which meant
  // one render showing nothing between every toast and the next.
  //
  // The check-in goes first when it is there, and it is held beside the
  // queue rather than merged into it because the fetch above REPLACES the
  // queue - the two arrive independently. Neither can land on top of the
  // other here: they are two slots read in a fixed order, not one slot
  // written twice.
  const current = checkInToast ?? queue[0] ?? null;

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
    // Dropping it from whichever slot it is showing from is what advances
    // to the next one - there is nothing else to advance.
    if (checkInToast && checkInToast.id === n.id) setCheckInToast(null);
    else setQueue((q) => q.filter((r) => r.id !== n.id));
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

  // Ahead of the toast's early return: the streak pop-up is not a toast
  // and must still appear on a load with nothing else queued, which is
  // the normal case for it.
  const streakModal = checkIn ? (
    <StreakRenewedModal
      streak={checkIn.streak}
      points={checkIn.points}
      longest={checkIn.longest}
      onClose={() => setCheckIn(null)}
    />
  ) : null;

  if (!current) return streakModal;

  const content = buildToastContent(current, referrals, actors);

  return (
    <>
      {streakModal}
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
        className="toast-card flex items-center gap-3 rounded-2xl border px-3.5 py-3 shadow-2xl shadow-black/40 cursor-pointer transition-[filter] hover:brightness-110"
        style={{ background: "#0b1730", borderColor: `${content.accentColor}55` }}
      >
        {content.avatarUrl ? (
          <img src={content.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover shrink-0 border border-white/15" />
        ) : (
          <span
            className="relative h-11 w-11 rounded-full flex items-center justify-center text-xl shrink-0"
            style={{ background: `${content.accentColor}26`, boxShadow: `0 0 16px -4px ${content.accentColor}` }}
          >
            {content.streak === undefined ? (
              content.initial
            ) : (
              // The pop-up's fire, at a third the size. The embers are
              // absolutely positioned and deliberately NOT clipped - they
              // throw past the edge of the mark and over the card, which
              // is the whole effect.
              <>
                {TOAST_EMBERS.map((e, i) => (
                  <span
                    key={i}
                    aria-hidden
                    className="toast-ember"
                    style={
                      {
                        ["--ex"]: `${e.x}px`,
                        ["--ey"]: `${e.y}px`,
                        animationDelay: `${e.delay}ms`,
                        background: e.hot ? "#ff5b2e" : "#fb923c",
                      } as React.CSSProperties
                    }
                  />
                ))}
                <span aria-hidden className="toast-flame block text-[26px] leading-none">
                  {content.initial}
                </span>
                {/* The count CHANGES rather than being stated - yesterday's
                    thrown up and out as today's arrives from below, the
                    same idea as the pop-up. Bottom padding puts it on the
                    flame's lower third rather than on the mark's rim. */}
                <span className="absolute inset-0 flex items-end justify-center pb-[7px] text-[11px] font-extrabold tabular-nums text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.85)]">
                  {content.streak > 1 && <span className="toast-num-old absolute">{content.streak - 1}</span>}
                  <span className="toast-num-new">{content.streak}</span>
                </span>
              </>
            )}
          </span>
        )}
        <div className="flex-1 min-w-0">
          {/* Two lines, not one, and a size down from text-sm. Four of the
              five notification types wanted more than the 224px this
              column has, and truncate spent the overflow by cutting
              mid-word. The copy above does most of the work now; the
              clamp is what catches the rest - a long display name, or a
              rank called "Practice Squad" rather than "MVP". */}
          <div
            className="text-xs text-white font-medium line-clamp-2 leading-[17px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
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
    </>
  );
}
