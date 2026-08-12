"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";

type Picks = Record<string, TeamAbbr>;

export function usePicks(week: number) {
  const storageKey = `pickem:picks:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    setPicks(raw ? JSON.parse(raw) : {});
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify(picks));
  }, [picks, loaded, storageKey]);

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

  return { picks, setPick, loaded };
}
