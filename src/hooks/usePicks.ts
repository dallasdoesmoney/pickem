"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";

type Picks = Record<string, TeamAbbr>;

export function usePicks(week: number) {
  const picksKey = `pickem:picks:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Corrupt/legacy stored values must not crash the page - fall back to
    // no picks and let the next save overwrite the bad entry.
    try {
      const rawPicks = localStorage.getItem(picksKey);
      setPicks(rawPicks ? JSON.parse(rawPicks) : {});
    } catch {
      setPicks({});
    }
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

  function resetPicks() {
    setPicks({});
  }

  return { picks, setPick, resetPicks, loaded };
}
