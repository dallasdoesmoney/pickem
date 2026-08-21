"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { errorMessage } from "@/lib/errorMessage";

// Where a password reset link lands.
//
// Supabase's recovery link carries a token that the client library
// exchanges for a short-lived session as soon as this page loads, so by
// the time anyone sees the form they are already signed in - just long
// enough to set a password. That is why there is no "current password"
// field here: proving you can read the mailbox is the proof.
//
// Reachable directly too, with no link, which is worth saying out loud
// on the page rather than showing an empty form that fails on submit.
const MIN = 6;

export default function ResetPasswordPage() {
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The token exchange happens in the background on load, so a single
    // getSession() can run before it lands. Listening covers both: the
    // event fires when recovery completes, and the immediate check
    // covers the case where it already had.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setReady("ok");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) setReady("ok");
      // Give the exchange a beat before calling it a dead link - it is
      // the difference between "this link expired" and "you were early".
      else setTimeout(() => !cancelled && setReady((r) => (r === "checking" ? "no-session" : r)), 2500);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < MIN) {
      setError(`Passwords need at least ${MIN} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Those two don't match.");
      return;
    }
    setBusy(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      setDone(true);
    } catch (err) {
      console.error("Password update failed", err);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35";

  return (
    <main className="flex-1 px-4 py-16 max-w-md w-full mx-auto">
      <div className="rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <h1 className="text-white text-xl" style={{ fontFamily: "var(--font-display)" }}>
          {done
            ? "PASSWORD CHANGED"
            : ready === "no-session"
              ? "THIS LINK HAS EXPIRED"
              : ready === "checking"
                ? "CHECKING YOUR LINK"
                : "SET A NEW PASSWORD"}
        </h1>

        {done ? (
          <>
            <p className="text-white/50 text-sm mt-2 mb-5">
              You&apos;re signed in with it already. Nothing else to do.
            </p>
            <Link
              href="/"
              className="block rounded-full px-5 py-2.5 text-sm text-center active:scale-95 transition-transform duration-150"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, #4ade80, #22c55e)",
                color: "#0e1b33",
              }}
            >
              START PICKING
            </Link>
          </>
        ) : ready === "checking" ? (
          <div className="flex items-center gap-3 mt-4">
            <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-white/50 text-sm">One second.</p>
          </div>
        ) : ready === "no-session" ? (
          <>
            <p className="text-white/50 text-sm mt-2 mb-5">
              Reset links are good for one visit, and they don&apos;t last long. Ask for a fresh one
              from the sign-in box and it&apos;ll work.
            </p>
            <Link
              href="/"
              className="block rounded-full border border-white/20 px-5 py-2.5 text-sm text-center text-white/70 hover:border-white/40 hover:text-white transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              BACK TO SIDELINE BREW
            </Link>
          </>
        ) : (
          <>
            <p className="text-white/50 text-sm mt-2 mb-5">
              Pick something you&apos;ll remember. Twice, so a typo can&apos;t lock you out again.
            </p>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <input
                type="password"
                required
                minLength={MIN}
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={field}
              />
              <input
                type="password"
                required
                minLength={MIN}
                autoComplete="new-password"
                placeholder="New password again"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={field}
              />
              {error && <p className="text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50"
                style={{
                  fontFamily: "var(--font-display)",
                  background: "linear-gradient(135deg, #4ade80, #22c55e)",
                  color: "#0e1b33",
                }}
              >
                {busy ? "SAVING…" : "SAVE PASSWORD"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
