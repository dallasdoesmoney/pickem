"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";

type Picks = Record<number, TeamAbbr>; // week -> predicted winner

export function useSeasonPicks(team: TeamAbbr) {
  const picksKey = `pickem:season-predictor:${team}`;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Corrupt/legacy stored values must not crash the page - fall back to
    // no picks and let the next save overwrite the bad entry.
    try {
      const raw = localStorage.getItem(picksKey);
      setPicks(raw ? JSON.parse(raw) : {});
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

  function setPick(week: number, winner: TeamAbbr) {
    setPicks((prev) => {
      if (prev[week] === winner) {
        const next = { ...prev };
        delete next[week];
        return next;
      }
      return { ...prev, [week]: winner };
    });
  }

  function resetPicks() {
    setPicks({});
  }

  return { picks, setPick, resetPicks, loaded };
}
