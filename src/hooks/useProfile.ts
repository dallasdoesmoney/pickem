"use client";

import { useEffect, useState } from "react";

const PROFILE_KEY = "pickem:profile";

export type Profile = { displayName: string; avatarDataUrl: string | null };

const DEFAULT_PROFILE: Profile = { displayName: "", avatarDataUrl: null };

export function useProfile() {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    setProfile(raw ? JSON.parse(raw) : DEFAULT_PROFILE);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile, loaded]);

  return { profile, setProfile, loaded };
}
