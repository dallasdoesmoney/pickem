"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";

type Picks = Record<string, TeamAbbr>;
type Locks = Record<string, boolean>;

export function usePicks(week: number) {
  const picksKey = `pickem:picks:week-${week}`;
  const locksKey = `pickem:locks:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [locks, setLocks] = useState<Locks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const rawPicks = localStorage.getItem(picksKey);
    const rawLocks = localStorage.getItem(locksKey);
    setPicks(rawPicks ? JSON.parse(rawPicks) : {});
    setLocks(rawLocks ? JSON.parse(rawLocks) : {});
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksKey, locksKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(picksKey, JSON.stringify(picks));
  }, [picks, loaded, picksKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(locksKey, JSON.stringify(locks));
  }, [locks, loaded, locksKey]);

  function setPick(gameId: string, team: TeamAbbr) {
    setPicks((prev) => {
      if (prev[gameId] === team) {
        const next = { ...prev };
        delete next[gameId];
        setLocks((prevLocks) => {
          if (!prevLocks[gameId]) return prevLocks;
          const nextLocks = { ...prevLocks };
          delete nextLocks[gameId];
          return nextLocks;
        });
        return next;
      }
      return { ...prev, [gameId]: team };
    });
  }

  function toggleLock(gameId: string) {
    setLocks((prev) => ({ ...prev, [gameId]: !prev[gameId] }));
  }

  return { picks, setPick, locks, toggleLock, loaded };
}
