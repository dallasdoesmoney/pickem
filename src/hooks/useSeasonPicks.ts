"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";
import { useAuth } from "@/hooks/useAuth";
import { fetchSeasonPicks } from "@/lib/supabase/picks";

type Picks = Record<number, TeamAbbr>; // week -> predicted winner

// `sandbox` is streamer mode - see usePicks for why this is enforced in
// the hook rather than at the call site.
export function useSeasonPicks(team: TeamAbbr, sandbox = false) {
  const { user, loading: authLoading } = useAuth();
  const picksKey = `pickem:season-predictor:${team}`;
  const [picks, setPicks] = useState<Picks>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Wait for the session check so signed-in users don't briefly flash
    // whatever's in local storage before swapping to their real picks.
    if (authLoading) return;

    let cancelled = false;
    setLoaded(false);

    async function load() {
      // A sandbox starts empty and reads nothing - not the account, not
      // this device.
      if (sandbox) {
        setPicks({});
        setLoaded(true);
        return;
      }
      if (user) {
        // Signed in: the database is authoritative, so predictions made
        // on another device show up here too. Local storage is kept in
        // sync as a fast local cache, not as the source of truth.
        try {
          const dbPicks = await fetchSeasonPicks(user.id, team);
          if (cancelled) return;
          setPicks(dbPicks);
          localStorage.setItem(picksKey, JSON.stringify(dbPicks));
          setLoaded(true);
          return;
        } catch (err) {
          console.error("Failed to load predictions from account, falling back to this device's local copy", err);
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
  }, [picksKey, team, user, authLoading, sandbox]);

  useEffect(() => {
    if (!loaded || sandbox) return;
    localStorage.setItem(picksKey, JSON.stringify(picks));
  }, [picks, loaded, picksKey, sandbox]);

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
