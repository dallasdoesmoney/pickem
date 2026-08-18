"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUsernameField } from "@/hooks/useUsernameField";
import { claimUsername } from "@/lib/supabase/profile";
import { USERNAME_MIN, USERNAME_MAX } from "@/lib/usernamePolicy";

// Mounted once, app-wide (see layout.tsx) - shows itself automatically
// whenever someone is signed in but hasn't claimed a username yet. This
// covers both sign-up paths with one code path: Google has no form of
// ours to collect a username in (it hands back a session immediately),
// so rather than special-case Google vs. email/password, EVERY account
// passes through here once, right after signing in, before it can do
// anything else. Not dismissable - usernames exist for the leaderboard
// this is laying groundwork for, so every account needs one.
export function UsernameGate() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const { username, setUsername, status } = useUsernameField();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const show = !loading && !!user && !!profile && !profile.username;
  if (!show) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status !== "available" || submitting || !user) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await claimUsername(user.id, username);
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    await refreshProfile();
  }

  const hintColor = status === "available" ? "#4ade80" : status === "taken" || status === "invalid" ? "#f87171" : "rgba(255,255,255,0.4)";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
          CLAIM YOUR USERNAME
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-5">This is how you&rsquo;ll show up in Standings. Pick something unique.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <input
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            placeholder="username"
            maxLength={USERNAME_MAX}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35"
          />
          <p className="text-xs h-4 -mt-1" style={{ color: hintColor }}>
            {status === "checking" && "Checking…"}
            {status === "available" && "Available"}
            {status === "taken" && "That username is taken"}
            {status === "invalid" && `${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, underscores only`}
          </p>

          {submitError && <p className="text-xs text-red-400">{submitError}</p>}

          <button
            type="submit"
            disabled={status !== "available" || submitting}
            className="mt-2 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-40"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            {submitting ? "SAVING…" : "CLAIM USERNAME"}
          </button>
        </form>
      </div>
    </div>
  );
}
