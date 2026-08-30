"use client";

import { useEffect, useState } from "react";
import { TeamAbbr } from "@/data/teams";
import { useAuth } from "@/hooks/useAuth";
import { fetchWeeklyPicks } from "@/lib/supabase/picks";

type Picks = Record<string, TeamAbbr>;

// `sandbox` is streamer mode: a scratch board for a guest to pick on.
// It has to be enforced here rather than at the call site, because there
// are two independent write paths out of this hook alone - local storage
// on every change, and the database read that seeds it - and the page
// adds three more on top. Anything less than "this hook cannot reach
// either store" risks a guest's picks landing on the host's account,
// which is the one failure that would make the mode unusable.
export function usePicks(week: number, sandbox = false) {
  const { user, loading: authLoading } = useAuth();
  const picksKey = `pickem:picks:week-${week}`;
  const lockKey = `pickem:lock:week-${week}`;
  const [picks, setPicks] = useState<Picks>({});
  const [lockedGameId, setLockedGameId] = useState<string | null>(null);
  // LOADED IS A COMPARISON, not a flag to be reset.
  //
  // It used to be a boolean set false at the top of the effect and true
  // when the fetch landed, which cost a render before the fetch had even
  // started. What it actually means is "the picks in hand belong to the
  // thing being asked about", so it records WHICH key it loaded and the
  // answer is a comparison at render. A user edit does not change the
  // key, so editing does not make the board look unloaded.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  // Everything the load depends on, in one string, so the effect and
  // the comparison below cannot fall out of step with each other.
  const loadKey = `${picksKey}|${lockKey}|${week}|${user?.id ?? ""}|${sandbox}`;
  const loaded = loadedFor === loadKey;

  useEffect(() => {
    // Wait for the session check so signed-in users don't briefly flash
    // whatever's in local storage before swapping to their real picks.
    if (authLoading) return;

    let cancelled = false;

    async function load() {
      // A sandbox starts empty and reads nothing: not the account, not
      // this device. Turning the mode on therefore clears the board, and
      // turning it off re-runs this effect and restores the real picks
      // from the account, untouched by whatever the guest did.
      if (sandbox) {
        setPicks({});
        setLockedGameId(null);
        setLoadedFor(loadKey);
        return;
      }
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
          setLoadedFor(loadKey);
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
      if (!cancelled) setLoadedFor(loadKey);
    }

    load();
    return () => {
      cancelled = true;
    };
    // loadKey is built from the rest of these, so listing both is
    // redundant - but the linter cannot see through a template string,
    // and a suppression here would be hiding a real dependency to save
    // one line.
  }, [loadKey, picksKey, lockKey, week, user, authLoading, sandbox]);

  useEffect(() => {
    if (!loaded || sandbox) return;
    localStorage.setItem(picksKey, JSON.stringify(picks));
  }, [picks, loaded, picksKey, sandbox]);

  useEffect(() => {
    if (!loaded || sandbox) return;
    if (lockedGameId) localStorage.setItem(lockKey, lockedGameId);
    else localStorage.removeItem(lockKey);
  }, [lockedGameId, loaded, lockKey, sandbox]);

  // A locked game that's no longer picked (fully unpicked, not just
  // switched to the other team) can't stay the lock - keeps the two
  // pieces of state honest without every call site remembering to clear
  // it manually.
  //
  // DERIVED, not synchronised. This was an effect that watched picks and
  // cleared the lock afterwards, which meant one render where a game was
  // unpicked and still showed as locked. It is a question with an answer
  // - is the locked game still picked? - so it is answered on the way
  // out instead. The stored id is allowed to go stale; nothing reads it
  // directly.
  const effectiveLock = lockedGameId && picks[lockedGameId] ? lockedGameId : null;

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

  return { picks, setPick, resetPicks, loaded, lockedGameId: effectiveLock, toggleLock };
}
