"use client";

import { LeaderboardBoard } from "@/components/LeaderboardBoard";

export default function LeaderboardPage() {
  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SEASON STANDINGS</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          LEADERBOARD
        </h1>
        <p className="text-white/50 text-sm mt-3">Ranked by total correct picks across every published week.</p>
      </div>

      <LeaderboardBoard />
    </main>
  );
}
