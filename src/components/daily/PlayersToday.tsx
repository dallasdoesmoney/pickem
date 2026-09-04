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
// resets when the puzzle does. Plus a fixed baseline on the way to the
// screen - see BASELINE, which is the one place that padding exists.
//
// The unit is a browser rather than an account, so somebody who has
// never signed in is counted. See 0061_daily_players.sql for what that
// does and does not store.

// Every 30 seconds. It is a counter on a card people glance at, not a
// stock ticker - polling harder would cost a request per viewer per
// second to move a number by one.
const POLL_MS = 30_000;

// A DISPLAY OFFSET, and it is worth being blunt about what it is: the
// number on screen is the real count PLUS this, so a day with ten real
// players reads 113. A deliberate choice, made knowingly, so a quiet
// morning never reads as "nobody plays this" - it replaces an earlier
// attempt at the same problem, a floor that simply hid the counter until
// 25 people had played and so hid it most of most days.
//
// DISPLAY ONLY, and that part is load-bearing. Nothing is written to the
// database with this in it: daily_players holds the true count,
// daily_players_today() returns the true count, and any query either of
// them ever answers is unaffected. The padding exists here, once, on the
// way to the screen - so the analytics stay honest and taking it out is
// a one-line change.
const BASELINE = 103;

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
//
// The only reason it draws nothing is that the count could not be READ.
// There is no low end to hide any more: with the baseline the smallest
// number it can show is 103.
export function showsCount(count: number | null): count is number {
  return count !== null;
}

// What goes on screen for a given real count.
export function displayCount(count: number): number {
  return count + BASELINE;
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
      <span className="tabular-nums">{displayCount(count).toLocaleString("en-US")}</span>
      <span>{strip ? "have played today" : "PLAYED TODAY"}</span>
    </span>
  );
}
