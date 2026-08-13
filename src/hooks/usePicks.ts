"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";

type Picks = Record<string, TeamAbbr>;

export function usePicks(week: number) {
  const picksKey = `pickem:picks:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const rawPicks = localStorage.getItem(picksKey);
    setPicks(rawPicks ? JSON.parse(rawPicks) : {});
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksKey]);

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

  return { picks, setPick, loaded };
}
