"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { DailyPuzzle } from "@/components/DailyPuzzle";

// Narrower than the leaderboard on purpose: the board is a stack of one
// player per row, and stretched to 2xl the chips end up marooned from the
// name they belong to.
export default function DailyPage() {
  const { user, loading } = useAuth();

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-lg w-full mx-auto">
      <div className="text-center mb-8">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">DAILY GAME</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          WHO AM I?
        </h1>
        <p className="text-white/50 text-sm mt-3">One mystery player a day. Same player for everyone.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : user ? (
        <DailyPuzzle />
      ) : (
        /* Signed out gets the pitch rather than a wall. The guesses have
           to be recorded against someone - eight tries only means
           anything if they cannot be reset by reloading. */
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
          <span className="text-3xl">🧠</span>
          <p className="text-base text-white">A new player every day</p>
          <p className="max-w-xs text-sm text-white/50">
            Eight guesses, and every one tells you something. Create a free profile to play — it keeps your streak and pays up to
            300 points a day.
          </p>
          <Link
            href="/account"
            className="mt-3 rounded-full px-6 py-2.5 text-sm active:scale-95 transition-transform duration-150"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
          >
            CREATE A PROFILE
          </Link>
        </div>
      )}
    </main>
  );
}
