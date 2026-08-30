"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import posthog from "posthog-js";
import { supabase } from "@/lib/supabase/client";
import { migrateLocalDataToAccount } from "@/lib/supabase/migration";
import { claimReferral } from "@/lib/supabase/referrals";
import { fetchLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { PENDING_REFERRAL_KEY } from "@/lib/referralStorage";
import { reportError } from "@/lib/sentry";

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
  // needsConfirmation: the account exists but there is no session yet,
  // because the address has to be proved first. Callers must not treat
  // this as signed in - see the comment on the implementation.
  signUpWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  pendingReferrerSuggestion: PendingReferrerSuggestion | null;
  clearPendingReferrerSuggestion: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// How long a new account keeps looking for a device with work on it.
//
// There has to be an end, because the keys the migration reads are also
// the keys usePicks writes as a signed-in cache. On a shared computer
// that means one person's cache is sitting there when the next person
// makes an account, and the migration cannot tell the two apart. Bounded
// to the first week, that window is the same one the code always had; left
// open forever it would slowly become a way to inherit a stranger's picks.
//
// A week is well past when somebody signs up on their phone and gets back
// to the laptop, which is the case this exists for.
const MIGRATION_GRACE_DAYS = 7;

function olderThanGrace(createdAt: string | null): boolean {
  if (!createdAt) return true;
  const age = Date.now() - new Date(createdAt).getTime();
  return !Number.isFinite(age) || age > MIGRATION_GRACE_DAYS * 24 * 60 * 60 * 1000;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data as Profile;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Migration is keyed on the DB flag, not on which auth event fired. This
  // ref holds the in-flight run so a duplicate within the same tab load -
  // the initial getSession() and an immediate onAuthStateChange both
  // resolving to the same signed-in user - AWAITS it rather than skipping
  // past it, before the flag flip round-trips. See resolveSession for why
  // skipping was the bug.
  const migrationRef = useRef<{ userId: string; done: Promise<void> } | null>(null);
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

    // MIGRATE BEFORE RELEASING `loading`, and this ordering is the whole
    // point rather than a detail.
    //
    // usePicks and useSeasonPicks both start with `if (authLoading)
    // return`, and both, once a user exists, treat the DATABASE as
    // authoritative - they fetch it and write the result back over the
    // local copy as a cache. So with loading released first, this raced,
    // and the race had a winner:
    //
    //   1. setLoading(false)
    //   2. useSeasonPicks sees a user, fetches an EMPTY season from the
    //      database, and caches that empty result to localStorage
    //   3. migrateLocalDataToAccount reads localStorage and finds {}
    //
    // Somebody who predicted a whole season signed out, then made an
    // account to save it, watched the board empty itself - and the thing
    // that erased their work was the cache write in step 2, a moment
    // before the migration that existed to rescue it.
    //
    // Holding `loading` true keeps both hooks parked, so the migration
    // reads the local storage it was written to read. The cost is that
    // the first load after signing up waits for it, which happens once
    // per account - profiles.migrated_local_picks makes sure of that.
    // A PROMISE, not a "busy" flag, and that distinction is load-bearing.
    // getSession() and onAuthStateChange both call this function, at the
    // same time, with the same session. A flag makes the second caller
    // SKIP the migration - correct, it must only run once - and then walk
    // straight on to setLoading(false) while the first is still copying
    // picks. Which put the empty fetch back in front of the migration and
    // reproduced the whole bug through a second door.
    //
    // Holding the promise means the second caller waits for the same work
    // instead of stepping over it. Keyed by user id so a different
    // account signing in later on the same page still gets its own.
    if (nextProfile && !nextProfile.migrated_local_picks) {
      if (migrationRef.current?.userId !== nextUser.id) {
        migrationRef.current = {
          userId: nextUser.id,
          done: (async () => {
            try {
              // Only settled once something was actually brought across,
              // or once the account is too old for a first device to
              // still be turning up with work on it.
              //
              // The flag used to be set unconditionally, and that is
              // what cost people their boards: sign up on a phone,
              // confirm on the phone, and the phone's run finds an empty
              // localStorage, brings nothing across and marks the
              // account done - so the laptop holding the actual season
              // predictor can never hand it over. Nothing looked wrong;
              // the work was just gone.
              //
              // Leaving it false is now cheap and safe. Cheap because a
              // browser with no guest keys makes no network calls at
              // all and returns immediately; safe because the migration
              // is additive and skips any week the account already has.
              const migrated = await migrateLocalDataToAccount(nextUser.id);
              const settled = migrated || olderThanGrace(nextProfile.created_at);
              if (settled) {
                await supabase.from("profiles").update({ migrated_local_picks: true }).eq("id", nextUser.id);
                setProfile((prev) => (prev ? { ...prev, migrated_local_picks: true } : prev));
              }
            } catch (err) {
              // Swallowed, not rethrown. This sits in front of
              // setLoading(false), so an exception escaping here would
              // park the whole app on its loading state forever - losing
              // the picks AND the site. The flag stays false in the
              // database, so the next load tries again.
              console.error("Failed to migrate this device's picks into the new account", err);
            }
          })(),
        };
      }
      await migrationRef.current.done;
    }

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
              .catch((err) => reportError("auth.referrerSuggestion", err));
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
  // needsConfirmation is read from the RESPONSE, not from a setting we
  // keep in sync by hand. Supabase hands back a session immediately when
  // the project auto-confirms and no session at all when it wants the
  // address proved first, so the same code covers both and flipping
  // "Confirm email" in the dashboard needs no deploy to match it.
  //
  // It is also true for a signup on an address that already has an
  // account: Supabase answers with no session and no error, deliberately,
  // so that this box cannot be used to find out who has signed up. "Check
  // your email" is the honest thing to say in both cases and gives that
  // away either way.
  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.href },
    });
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session };
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
