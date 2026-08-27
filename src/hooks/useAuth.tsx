"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import posthog from "posthog-js";
import { supabase } from "@/lib/supabase/client";
import { migrateLocalDataToAccount } from "@/lib/supabase/migration";
import { claimReferral } from "@/lib/supabase/referrals";
import { fetchLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { PENDING_REFERRAL_KEY } from "@/lib/referralStorage";

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  username: string | null;
  is_admin: boolean;
  migrated_local_picks: boolean;
  referred_by: string | null;
  onboarding_avatar_prompted: boolean;
  follow_recs_prompted: boolean;
  onboarding_referral_prompted: boolean;
  // Read by FollowRecsGate to tell a genuine onboarding walk-through
  // apart from an existing account being backfilled.
  created_at: string | null;
};

export type PendingReferrerSuggestion = { userId: string; label: string; avatarUrl: string | null };

type AuthContextValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  pendingReferrerSuggestion: PendingReferrerSuggestion | null;
  clearPendingReferrerSuggestion: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Migration is keyed on the DB flag, not on which auth event fired - this
  // ref just stops a duplicate run within the same tab load (e.g. the
  // initial getSession() and an immediate onAuthStateChange both resolving
  // to the same signed-in user) before the flag flip round-trips.
  const migratingRef = useRef(false);
  const identifiedUserIdRef = useRef<string | null>(null);
  const claimingReferralRef = useRef(false);
  const [pendingReferrerSuggestion, setPendingReferrerSuggestion] = useState<PendingReferrerSuggestion | null>(null);

  // Captured on first load (not just the signup page - a shared link can
  // land anywhere) and kept until claimed, so someone who clicks an invite
  // link and signs up days later still gets attributed correctly.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) localStorage.setItem(PENDING_REFERRAL_KEY, ref);
  }, []);

  const resolveSession = useCallback(async (session: Session | null) => {
    const nextUser = session?.user ?? null;
    setUser(nextUser);

    if (!nextUser) {
      if (identifiedUserIdRef.current) {
        posthog.reset();
        identifiedUserIdRef.current = null;
      }
      setProfile(null);
      setLoading(false);
      return;
    }

    const nextProfile = await fetchProfile(nextUser.id);
    setProfile(nextProfile);
    setLoading(false);

    if (identifiedUserIdRef.current !== nextUser.id) {
      if (identifiedUserIdRef.current) posthog.reset();

      posthog.identify(nextUser.id, {
        email: nextUser.email,
        username: nextProfile?.username,
        display_name: nextProfile?.display_name,
        is_admin: nextProfile?.is_admin,
      });
      identifiedUserIdRef.current = nextUser.id;
    }

    if (nextProfile && !nextProfile.migrated_local_picks && !migratingRef.current) {
      migratingRef.current = true;
      try {
        await migrateLocalDataToAccount(nextUser.id);
        await supabase.from("profiles").update({ migrated_local_picks: true }).eq("id", nextUser.id);
        setProfile((prev) => (prev ? { ...prev, migrated_local_picks: true } : prev));
      } finally {
        migratingRef.current = false;
      }
    }

    if (nextProfile && !nextProfile.referred_by && !claimingReferralRef.current) {
      const pendingCode = localStorage.getItem(PENDING_REFERRAL_KEY);
      if (pendingCode) {
        claimingReferralRef.current = true;
        try {
          // The code the link carried can be junk - a username that has
          // since changed, or one that never existed. claim_referral says
          // which, so a link that credited nobody no longer marks this
          // account as referred: it leaves them for ReferralPromptGate to
          // ask, which is the whole point of that gate.
          const result = await claimReferral(pendingCode);
          localStorage.removeItem(PENDING_REFERRAL_KEY);
          if (result === "ok" || result === "already_claimed") {
            setProfile((prev) => (prev ? { ...prev, referred_by: "claimed" } : prev));
            // Best-effort - if the referrer lookup fails, we just skip the
            // suggestion prompt rather than blocking the claim itself,
            // which has already succeeded by this point.
            fetchLeaderboardEntry(pendingCode)
              .then((row) => {
                if (row) setPendingReferrerSuggestion({ userId: row.user_id, label: row.display_name || row.username, avatarUrl: row.avatar_url });
              })
              .catch(() => {});
          }
        } catch (err) {
          console.error("Referral claim failed", err);
        } finally {
          claimingReferralRef.current = false;
        }
      }
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => resolveSession(data.session));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      resolveSession(session);
    });

    return () => subscription.subscription.unsubscribe();
  }, [resolveSession]);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  // emailRedirectTo, so a confirmation link comes back to the page the
  // person signed up FROM rather than to the site root.
  //
  // It matters most on the daily game: somebody signs up from the end of
  // a lost board specifically to be told who it was, and without this the
  // link drops them on the home page with no idea where their result
  // went. Google already did the equivalent through redirectTo below; the
  // email path was the one that did not.
  //
  // Supabase only honours a redirect that matches an allowed URL in the
  // project's auth settings, so an origin that has not been listed there
  // falls back to the Site URL - which is the old behaviour, not a break.
  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href },
    });
    return { error: error?.message ?? null };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.href } });
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    setProfile(await fetchProfile(user.id));
  }, [user]);

  const clearPendingReferrerSuggestion = useCallback(() => setPendingReferrerSuggestion(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signOut,
        refreshProfile,
        pendingReferrerSuggestion,
        clearPendingReferrerSuggestion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
