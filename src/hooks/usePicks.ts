"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";

export type SpecialPick = "lock" | "blowout";

type Picks = Record<string, TeamAbbr>;
type Specials = Record<string, SpecialPick>;

export const MAX_LOCKS = 1;
export const MAX_BLOWOUTS = 1;

// undefined ("none") is an explicit stop in the cycle, not just a fallback -
// otherwise a 2-category cycle can toggle between them forever.
const CYCLE: (SpecialPick | undefined)[] = [undefined, "lock", "blowout"];
const SPECIAL_CAPS: Record<SpecialPick, number> = { lock: MAX_LOCKS, blowout: MAX_BLOWOUTS };

export function usePicks(week: number) {
  const picksKey = `pickem:picks:week-${week}`;
  const specialsKey = `pickem:specials:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [specials, setSpecials] = useState<Specials>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const rawPicks = localStorage.getItem(picksKey);
    const rawSpecials = localStorage.getItem(specialsKey);
    setPicks(rawPicks ? JSON.parse(rawPicks) : {});
    setSpecials(rawSpecials ? JSON.parse(rawSpecials) : {});
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picksKey, specialsKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(picksKey, JSON.stringify(picks));
  }, [picks, loaded, picksKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(specialsKey, JSON.stringify(specials));
  }, [specials, loaded, specialsKey]);

  function setPick(gameId: string, team: TeamAbbr) {
    setPicks((prev) => {
      if (prev[gameId] === team) {
        const next = { ...prev };
        delete next[gameId];
        setSpecials((prevSpecials) => {
          if (!prevSpecials[gameId]) return prevSpecials;
          const nextSpecials = { ...prevSpecials };
          delete nextSpecials[gameId];
          return nextSpecials;
        });
        return next;
      }
      return { ...prev, [gameId]: team };
    });
  }

  // Cycles a game's special pick: none -> lock -> blowout -> none, skipping
  // any category that's already used up on a different game (each capped
  // at 1 for now), so the same press-and-hold gesture works for both.
  function cycleSpecial(gameId: string) {
    setSpecials((prev) => {
      const current = prev[gameId];
      const currentIndex = CYCLE.indexOf(current);

      for (let step = 1; step <= CYCLE.length; step++) {
        const candidate = CYCLE[(currentIndex + step) % CYCLE.length];
        if (candidate === undefined) {
          const next = { ...prev };
          delete next[gameId];
          return next;
        }
        const usedByOtherGames = Object.entries(prev).filter(
          ([gid, val]) => gid !== gameId && val === candidate
        ).length;
        if (usedByOtherGames < SPECIAL_CAPS[candidate]) {
          return { ...prev, [gameId]: candidate };
        }
      }

      const next = { ...prev };
      delete next[gameId];
      return next;
    });
  }

  return { picks, setPick, specials, cycleSpecial, loaded };
}
