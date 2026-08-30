"use client";

import { useEffect, useState } from "react";

const PROFILE_KEY = "pickem:profile";

export type Profile = { displayName: string; avatarDataUrl: string | null };

const DEFAULT_PROFILE: Profile = { displayName: "", avatarDataUrl: null };

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  // READING BROWSER STORAGE AFTER MOUNT IS THE POINT, and it is why this
  // one setState in an effect stays.
  //
  // localStorage does not exist on the server. Reading it in the state
  // initialiser would have the server render the default profile and the
  // client render the stored one off the same HTML, which is a hydration
  // mismatch - React discards the tree and warns. useSyncExternalStore
  // is the usual answer for an external store, but this one is read once
  // and then owned by React, not subscribed to.
  //
  // So the effect is correct here and the rule is a blunt instrument.
  // Same trade, and the same comment, as the guest board in DailyPuzzle.
  useEffect(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProfile(raw ? JSON.parse(raw) : DEFAULT_PROFILE);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile, loaded]);

  return { profile, setProfile, loaded };
}
