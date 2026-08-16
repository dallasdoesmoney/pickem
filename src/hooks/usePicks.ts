"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";
import { useAuth } from "@/hooks/useAuth";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";

type Picks = Record<string, TeamAbbr>;

export function usePicks(week: number) {
  const { user, loading: authLoading } = useAuth();
  const picksKey = `pickem:picks:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Wait for the session check so signed-in users don't briefly flash
    // whatever's in local storage before swapping to their real picks.
    if (authLoading) return;

    let cancelled = false;
    setLoaded(false);

    async function load() {
      if (user) {
        // Signed in: the database is authoritative, so picks made on
        // another device (or a past week's graded picks) show up here
        // too. Local storage is kept in sync as a fast local cache, not
        // as the source of truth.
        try {
          const dbPicks = await fetchWeeklyPicks(user.id, week);
          if (cancelled) return;
          setPicks(dbPicks);
          localStorage.setItem(picksKey, JSON.stringify(dbPicks));
          setLoaded(true);
          return;
        } catch (err) {
          console.error("Failed to load picks from account, falling back to this device's local copy", err);
        }
      }
      // Signed out, or the DB fetch failed - fall back to whatever this
      // device already has. Corrupt/legacy stored values must not crash
      // the page.
      try {
        const raw = localStorage.getItem(picksKey);
        if (!cancelled) setPicks(raw ? JSON.parse(raw) : {});
      } catch {
        if (!cancelled) setPicks({});
      }
      if (!cancelled) setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [picksKey, week, user, authLoading]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(picksKey, JSON.stringify(picks));
  }, [picks, loaded, picksKey]);

  function setPick(gameId: string, team: TeamAbbr) {
    setPicks((prev) => {
      if (prev[gameId] === team) {
        const next = { ...prev };
        delete next[gameId];
        return next;
      }
      return { ...prev, [gameId]: team };
    });
  }

  function resetPicks() {
    setPicks({});
  }

  return { picks, setPick, resetPicks, loaded };
}
