"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { unsubscribeByToken } from "@/lib/supabase/emailPrefs";

// The page an unsubscribe link lands on.
//
// It runs the moment it loads rather than asking anyone to confirm.
// A confirmation step reads as a site trying to talk you out of leaving,
// and every extra click between "I want this to stop" and it stopping is
// a click somebody spends reporting the mail as spam instead - which
// costs the sending domain far more than the subscriber did.
//
// No sign-in, deliberately. Whoever clicked is in their inbox, probably
// on a different device from the one they last logged in on.
function Unsubscribe() {
  const params = useSearchParams();
  const token = params.get("t");
  // A missing token is known at render, so it is the initial state
  // rather than something an effect corrects on the next tick - which
  // would both flash "one moment" at somebody who was never going to get
  // one, and set state synchronously inside an effect.
  const [state, setState] = useState<"working" | "done" | "bad" | "error">(token ? "working" : "bad");

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    unsubscribeByToken(token)
      .then((ok) => !cancelled && setState(ok ? "done" : "bad"))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-20 text-center">
      <h1 className="text-3xl leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
        {state === "done" ? "UNSUBSCRIBED" : state === "working" ? "ONE MOMENT" : "HMM"}
      </h1>

      {state === "working" && <p className="mt-4 text-sm text-white/50">Turning off your emails.</p>}

      {state === "done" && (
        <>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            You won&rsquo;t get any more emails from Sideline Brew &mdash; not pick reminders, not game updates.
            Nothing else about your account has changed: your picks, your streak and your points are all exactly
            where you left them.
          </p>
          <p className="mt-3 text-sm text-white/45">
            Wanted to keep one of them? Both switches live under Email preferences on your profile, and you can turn
            either back on any time.
          </p>
        </>
      )}

      {/* An unknown token and an already-used one look the same on purpose:
          the function does not distinguish them, so nobody can sit and
          probe for which tokens are real. */}
      {state === "bad" && (
        <p className="mt-4 text-[15px] leading-relaxed text-white/70">
          That link didn&rsquo;t match anything &mdash; it may have already been used, which means you are unsubscribed
          either way. You can always check from your profile.
        </p>
      )}

      {state === "error" && (
        <p className="mt-4 text-[15px] leading-relaxed text-white/70">
          Something went wrong on our end, so nothing changed. Try the link again, or turn emails off under Email
          preferences on your profile.
        </p>
      )}

      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/account"
          className="rounded-full border border-white/15 px-6 py-2.5 text-xs transition-colors hover:border-white/35"
          style={{ fontFamily: "var(--font-display)" }}
        >
          GO TO MY PROFILE
        </Link>
        <Link href="/" className="text-xs text-white/40 transition-colors hover:text-white/70">
          Back to Sideline Brew &rarr;
        </Link>
      </div>
    </main>
  );
}

// useSearchParams needs a Suspense boundary or the whole route opts out
// of static rendering and Next fails the build.
export default function UnsubscribePage() {
  return (
    <Suspense fallback={<main className="flex-1" />}>
      <Unsubscribe />
    </Suspense>
  );
}
