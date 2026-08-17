"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { getPendingReferralCode } from "@/lib/referralStorage";

type ModalState = { resolve: (ok: boolean) => void } | null;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.66Z"
      />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.28a12 12 0 0 0 0 10.74l3.99-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

// Mirrors useConfirmDialog.tsx's shape (own state, own JSX, promise-based
// requestSignIn()) so this fits the same call pattern the rest of the app
// already uses: `if (await requestSignIn()) doThing()`.
export function useSignInModal() {
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();
  const [state, setState] = useState<ModalState>(null);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [referrer, setReferrer] = useState<{ label: string; avatarUrl: string | null } | null>(null);

  // initialMode lets a caller force straight into "signup" (e.g. a "Sign
  // Up Free" button shouldn't land on the sign-IN form) - defaults to the
  // existing referral-code-aware behavior when omitted.
  const requestSignIn = useCallback((initialMode?: "signin" | "signup") => {
    setMode(initialMode ?? (getPendingReferralCode() ? "signup" : "signin"));
    setEmail("");
    setPassword("");
    setError(null);
    return new Promise<boolean>((resolve) => {
      setState({ resolve });
    });
  }, []);

  // Shown regardless of which button opened the modal (banner, Save &
  // Submit, whatever) - anyone signing up with a pending referral code
  // sees the context, not just people who came in through the banner.
  useEffect(() => {
    if (!state) {
      setReferrer(null);
      return;
    }
    const code = getPendingReferralCode();
    if (!code) return;
    fetchLeaderboardEntry(code)
      .then((row) => setReferrer(row ? { label: row.display_name || row.username, avatarUrl: row.avatar_url } : null))
      .catch(() => setReferrer(null));
  }, [state]);

  function close(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = mode === "signin" ? await signInWithPassword(email, password) : await signUpWithPassword(email, password);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    close(true);
  }

  async function handleGoogle() {
    // The redirect is a full page navigation away and back, so any promise
    // from requestSignIn() is abandoned - callers check this flag once the
    // page reloads with a session to auto-fire whatever they were waiting on.
    sessionStorage.setItem("pickem:pending-save-intent", "1");
    await signInWithGoogle();
  }

  const modal = state && (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={() => close(false)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <button
          type="button"
          aria-label="Close"
          onClick={() => close(false)}
          className="absolute top-4 right-4 h-7 w-7 rounded-full border border-white/15 text-white/50 hover:text-white flex items-center justify-center transition-colors"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>

        <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
          {mode === "signin" ? "SIGN IN" : "CREATE ACCOUNT"}
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-4">{mode === "signin" ? "Sign in to save your picks." : "Create an account to save your picks."}</p>

        {referrer && mode === "signup" && (
          <div className="flex flex-col items-center gap-1.5 text-center mb-4">
            {referrer.avatarUrl ? (
              <img src={referrer.avatarUrl} alt="" className="h-12 w-12 rounded-full object-cover border border-white/15" />
            ) : (
              <span
                className="h-12 w-12 rounded-full flex items-center justify-center text-base font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
              >
                {referrer.label.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="text-xs text-white/70">
              Invited by <span className="text-white font-medium">{referrer.label}</span>
            </span>

            <div className="grid grid-cols-3 gap-2 w-full mt-2.5">
              <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
                <span className="text-base leading-none">🏆</span>
                <span className="text-[10px] font-semibold mt-0.5">1,000 PTS</span>
                <span className="text-[8.5px] text-white/40">You both earn</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
                <span className="text-base leading-none">💾</span>
                <span className="text-[10px] font-semibold mt-0.5">SAVE PICKS</span>
                <span className="text-[8.5px] text-white/40">Any device</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
                <span className="text-base leading-none">👥</span>
                <span className="text-[10px] font-semibold mt-0.5">COMPARE</span>
                <span className="text-[8.5px] text-white/40">With friends</span>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-60"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            {submitting ? "PLEASE WAIT…" : mode === "signin" ? "SIGN IN" : "SIGN UP"}
          </button>
        </form>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] text-white/35">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm border border-white/15 text-white/80 hover:border-white/30 hover:text-white transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <GoogleIcon className="h-4 w-4" />
          CONTINUE WITH GOOGLE
        </button>

        <button
          type="button"
          onClick={() => {
            setMode((m) => (m === "signin" ? "signup" : "signin"));
            setError(null);
          }}
          className="w-full text-center text-xs text-white/45 hover:text-white/70 mt-4 transition-colors"
        >
          {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );

  return { requestSignIn, signInModal: modal };
}
