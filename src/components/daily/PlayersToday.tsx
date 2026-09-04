"use client";

import { useEffect, useState } from "react";
import { fetchPlayersToday } from "@/lib/supabase/dailyPlayers";

// HOW MANY PEOPLE HAVE PLAYED TODAY, live.
//
// Chosen out of four - a corner badge over the card art, a rolling
// number, a radar ping - and this one won for adding nothing. The home
// card's status line ALREADY has a coloured dot on it; the dot just
// starts breathing and the count joins the line it was already on. No
// new furniture on either page.
//
// A COUNT OF PEOPLE SINCE MIDNIGHT EASTERN, not a running total: it
// resets when the puzzle does, so at 00:05 it honestly says a small
// number. Which is why it draws nothing at all below a floor - see
// MIN_SHOWN. "3 played today" is worse than silence.
//
// The unit is a browser rather than an account, so somebody who has
// never signed in is counted. See 0061_daily_players.sql for what that
// does and does not store.

// Every 30 seconds. It is a counter on a card people glance at, not a
// stock ticker - polling harder would cost a request per viewer per
// second to move a number by one.
const POLL_MS = 30_000;

// Below this it says nothing. A brand-new day, or a quiet hour, and the
// honest number is "4" - which reads as "nobody plays this" rather than
// as "the day just started". Silence says neither.
const MIN_SHOWN = 25;

export function usePlayersToday(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const read = () => {
      fetchPlayersToday().then((n) => {
        if (!cancelled) setCount(n);
      });
    };
    read();
    const t = setInterval(read, POLL_MS);
    // Coming back to a tab that has been open since yesterday should not
    // show yesterday's number, and a phone waking from a pocket is the
    // most common way this is ever seen.
    const onWake = () => {
      if (document.visibilityState === "visible") read();
    };
    document.addEventListener("visibilitychange", onWake);
    return () => {
      cancelled = true;
      clearInterval(t);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, []);

  return count;
}

export function CounterStyles() {
  return (
    <style>{`
      @keyframes dailyLiveBreath {
        0%, 100% { opacity: 0.45; transform: scale(0.85); }
        50%      { opacity: 1;    transform: scale(1); }
      }
      .daily-live-dot { animation: dailyLiveBreath 1.8s ease-in-out infinite; }
      @media (prefers-reduced-motion: reduce) {
        .daily-live-dot { animation: none; opacity: 1; }
      }
    `}</style>
  );
}

const LIVE = "#4ade80";

// THE INDICATOR.
//
// `inline` is the home card's status line, where it REPLACES that line's
// static dot rather than sitting beside it - two dots on one line is the
// tell that something was bolted on. `strip` is the game page, where
// there is room to say it in words.
//
// Renders nothing at all when the count is unknown or below the floor,
// so neither page has to reserve space for it or handle its absence.
// Whether the counter will draw anything, so a caller can lay out the
// line around it - the home card's status text says "TODAY" too, and
// two of them on one line reads as a bug.
export function showsCount(count: number | null): count is number {
  return count !== null && count >= MIN_SHOWN;
}

export function PlayersToday({ count, variant = "inline" }: { count: number | null; variant?: "inline" | "strip" }) {
  if (!showsCount(count)) return null;
  const strip = variant === "strip";
  const size = strip ? 8 : 6;
  return (
    <span className="inline-flex items-center" style={{ gap: strip ? 8 : 6, fontSize: strip ? 13 : undefined }}>
      <span className="daily-live-dot shrink-0 rounded-full" style={{ width: size, height: size, background: LIVE }} />
      {/* tabular-nums so a tick from 999 to 1,000 does not shove the
          words along. */}
      <span className="tabular-nums">{count.toLocaleString("en-US")}</span>
      <span>{strip ? "have played today" : "PLAYED TODAY"}</span>
    </span>
  );
}
