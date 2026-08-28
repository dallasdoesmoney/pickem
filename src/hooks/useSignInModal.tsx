"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { getPendingReferralCode } from "@/lib/referralStorage";
import { sendPasswordReset } from "@/lib/supabase/profile";
import { errorMessage } from "@/lib/errorMessage";

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
  // "forgot" is a third mode rather than a separate dialog: it is the
  // same email field, and coming back from it should land on sign-in
  // with what you typed still there.
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  // Separate from sentTo, which is the forgot-password message. This one
  // replaces the whole form: there is nothing left to type.
  const [confirmSentTo, setConfirmSentTo] = useState<string | null>(null);
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
    setConfirm("");
    setSentTo(null);
    setConfirmSentTo(null);
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

    if (mode === "forgot") {
      setSubmitting(true);
      try {
        await sendPasswordReset(email);
        // Said the same way whether or not that address has an account.
        // Anything else turns this box into a way to find out who has
        // signed up.
        setSentTo(email);
      } catch (err) {
        console.error("Password reset failed", err);
        setError(errorMessage(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    // Checked here rather than left to the browser: two fields that
    // don't match is a typo you want caught before an account exists
    // with a password nobody knows.
    if (mode === "signup" && password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }

    setSubmitting(true);
    const result = mode === "signin" ? await signInWithPassword(email, password) : await signUpWithPassword(email, password);
    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    // Signed up, but there is no session until the link in the email is
    // clicked. Closing here would look exactly like success and then
    // silently not be - the caller would go to save and find nobody
    // signed in - so the modal stays open and says what has to happen
    // next instead.
    if ("needsConfirmation" in result && result.needsConfirmation) {
      setConfirmSentTo(email);
      return;
    }
    close(true);
  }

  function switchTo(next: "signin" | "signup" | "forgot") {
    setMode(next);
    setError(null);
    setSentTo(null);
    setConfirmSentTo(null);
    setPassword("");
    setConfirm("");
  }

  async function handleGoogle() {
    // The redirect is a full page navigation away and back, so any promise
    // from requestSignIn() is abandoned - callers check this flag once the
    // page reloads with a session to auto-fire whatever they were waiting on.
    sessionStorage.setItem("pickem:pending-save-intent", "1");
    await signInWithGoogle();
  }

  const modal = state && (
    // z-[80] puts this above every other dialog in the app, because it is
    // the one that interrupts them: a flow can be halfway through its own
    // modal (naming a tier list, say) when it discovers it needs an
    // account, and the sign-in has to land in front of that, not behind.
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4" role="dialog" aria-modal="true">
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
          {confirmSentTo ? "CHECK YOUR EMAIL" : mode === "signin" ? "SIGN IN" : mode === "signup" ? "CREATE ACCOUNT" : "FORGOT PASSWORD"}
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-3">
          {confirmSentTo
            ? "One click and you're in."
            : mode === "signin"
              ? "Pick up where you left off."
              : mode === "signup"
                ? "Free, and it takes about ten seconds."
                : "We'll email you a link to set a new one."}
        </p>

        {/* Everything below is hidden while this is up, because there is
            nothing left to type - the account exists and the only thing
            that finishes it is in an inbox. */}
        {confirmSentTo && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-white/70 leading-relaxed">
              {/* anywhere, not break-all: a normal address wraps whole
                  onto its own line, and only one long enough to need it
                  gets split. break-all cut someone@example.com after
                  "example.co". */}
              We sent a confirmation link to{" "}
              <span className="text-white font-medium [overflow-wrap:anywhere]">{confirmSentTo}</span>. Click it and
              you&rsquo;ll come straight back here, signed in.
            </p>
            {/* Said plainly because a typo'd address is the single most
                likely reason that link never arrives, and the fix is to
                sign up again rather than to keep waiting. */}
            <p className="text-xs text-white/40 leading-relaxed">
              Check the spam folder too. Nothing there? The address may have a typo &mdash;{" "}
              <button
                type="button"
                onClick={() => {
                  setConfirmSentTo(null);
                  setPassword("");
                  setConfirm("");
                }}
                className="text-white/60 underline underline-offset-2 hover:text-white transition-colors"
              >
                try a different one
              </button>
              .
            </p>
            <button
              type="button"
              onClick={() => close(false)}
              className="mt-1 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150"
              style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
            >
              GOT IT
            </button>
            {/* Their work is still on this device and still theirs - the
                migration in useAuth runs whenever a session shows up, so
                confirming in the same browser picks it all up. Worth
                saying, because "you are not signed in yet" reads like
                "you just lost it". */}
            <p className="text-[11px] text-white/35 leading-relaxed text-center">
              Nothing you&rsquo;ve done is lost. It&rsquo;s saved on this device and moves to your account when you confirm.
            </p>
          </div>
        )}

        {/* What an account actually buys. This modal is the only place
            most people meet that pitch, and "sign in to save your picks"
            undersold it - saving tier lists, the leaderboard and the
            season predictor were all invisible from here. */}
        {mode !== "forgot" && !confirmSentTo && (
        <ul className="flex flex-col gap-2 mb-4">
          {[
            "Save tier lists and come back to them later",
            "Keep every week's picks in one place",
            "Climb the leaderboard against your friends",
            "Earn badges and levels as you go",
          ].map((benefit) => (
            <li key={benefit} className="flex items-start gap-2 text-sm text-white/70">
              <svg viewBox="0 0 24 24" className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {benefit}
            </li>
          ))}
        </ul>
        )}

        {referrer && mode === "signup" && !confirmSentTo && (
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

        {!confirmSentTo && (
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
          {mode !== "forgot" && (
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
          )}

          {/* Twice, on the way in only. Signing up is the one moment
              nobody can check their work: there is no existing password
              to fail against, so a typo here creates a real account with
              a password its owner has never seen. */}
          {mode === "signup" && (
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              placeholder="Password again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35"
            />
          )}

          {sentTo && (
            <p className="text-xs text-emerald-400">
              If {sentTo} has an account, a reset link is on its way. Check the spam folder too.
            </p>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-1 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-60"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            {submitting
              ? "PLEASE WAIT…"
              : mode === "signin"
                ? "SIGN IN"
                : mode === "signup"
                  ? "SIGN UP"
                  : "EMAIL ME A LINK"}
          </button>

          {/* Said at the point of signing up, because consent nobody is
              told about is not much of a disclosure - and because the
              first reminder landing unannounced is what turns an
              unsubscribe into a spam report. Named the same thing the
              account page calls it, so somebody hunting for the switch
              is looking for the words they were shown here. */}
          {mode === "signup" && (
            <p className="mt-3 text-center text-[11px] leading-relaxed text-white/40">
              You&rsquo;ll get pick reminders by email before each week locks. Turn them off any time in your profile.
            </p>
          )}
        </form>
        )}

        {/* The way back in when the password is gone. There was no way at
            all before this - an account whose password was forgotten was
            simply lost, and the only tell was people signing up again. */}
        <div className="mt-3 text-center">
          {confirmSentTo ? null : mode === "signin" ? (
            <button
              type="button"
              onClick={() => switchTo("forgot")}
              className="text-xs text-white/45 underline underline-offset-2 hover:text-white/80 transition-colors"
            >
              Forgot your password?
            </button>
          ) : mode === "forgot" ? (
            <button
              type="button"
              onClick={() => switchTo("signin")}
              className="text-xs text-white/45 underline underline-offset-2 hover:text-white/80 transition-colors"
            >
              Back to sign in
            </button>
          ) : null}
        </div>

        {!confirmSentTo && (
        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-[11px] text-white/35">OR</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
        )}

        {!confirmSentTo && (
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm border border-white/15 text-white/80 hover:border-white/30 hover:text-white transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <GoogleIcon className="h-4 w-4" />
          CONTINUE WITH GOOGLE
        </button>
        )}

        {!confirmSentTo && (
        <button
          type="button"
          onClick={() => {
            switchTo(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="w-full text-center text-xs text-white/45 hover:text-white/70 mt-4 transition-colors"
        >
          {mode === "signup" ? "Already have an account? Sign in" : "Need an account? Sign up"}
        </button>
        )}
      </div>
    </div>
  );

  return { requestSignIn, signInModal: modal };
}
