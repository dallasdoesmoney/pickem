"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";
import { useAuth } from "@/hooks/useAuth";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";

type Picks = Record<string, TeamAbbr>;

export function usePicks(week: number) {
  const { user, loading: authLoading } = useAuth();
  const picksKey = `pickem:picks:week-${week}`;
  const lockKey = `pickem:lock:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [lockedGameId, setLockedGameId] = useState<string | null>(null);
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
          const { picks: dbPicks, lockedGameId: dbLock } = await fetchWeeklyPicks(user.id, week);
          if (cancelled) return;
          setPicks(dbPicks);
          setLockedGameId(dbLock);
          localStorage.setItem(picksKey, JSON.stringify(dbPicks));
          if (dbLock) localStorage.setItem(lockKey, dbLock);
          else localStorage.removeItem(lockKey);
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
      if (!cancelled) setLockedGameId(localStorage.getItem(lockKey));
      if (!cancelled) setLoaded(true);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [picksKey, lockKey, week, user, authLoading]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(picksKey, JSON.stringify(picks));
  }, [picks, loaded, picksKey]);

  useEffect(() => {
    if (!loaded) return;
    if (lockedGameId) localStorage.setItem(lockKey, lockedGameId);
    else localStorage.removeItem(lockKey);
  }, [lockedGameId, loaded, lockKey]);

  // A locked game that's no longer picked (fully unpicked, not just
  // switched to the other team) can't stay the lock - keeps the two
  // pieces of state honest without every call site remembering to clear
  // it manually.
  useEffect(() => {
    if (lockedGameId && !picks[lockedGameId]) setLockedGameId(null);
  }, [picks, lockedGameId]);

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

  function toggleLock(gameId: string) {
    setLockedGameId((prev) => (prev === gameId ? null : gameId));
  }

  function resetPicks() {
    setPicks({});
    setLockedGameId(null);
  }

  return { picks, setPick, resetPicks, loaded, lockedGameId, toggleLock };
}
