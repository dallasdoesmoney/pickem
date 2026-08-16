"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchLeaderboard, LeaderboardRow } from "@/lib/supabase/leaderboard";
import { errorMessage } from "@/lib/errorMessage";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLeaderboard()
      .then(setRows)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SEASON STANDINGS</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          LEADERBOARD
        </h1>
        <p className="text-white/50 text-sm mt-3">Ranked by total correct picks across every published week.</p>
      </div>

      {error && <p className="text-sm text-red-400 text-center mb-4">{error}</p>}

      {!rows ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-white/50">
          <div className="text-4xl mb-3">🏈</div>
          <p className="text-sm">No records yet — check back once a week&rsquo;s results are published.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const isMe = row.user_id === user?.id;
            return (
              <div
                key={row.user_id}
                className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                  isMe ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5"
                }`}
              >
                <span className="w-6 text-center text-sm text-white/40" style={{ fontFamily: "var(--font-display)" }}>
                  {i + 1}
                </span>
                {row.avatar_url ? (
                  <img src={row.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover shrink-0" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">
                    {row.username.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="flex-1 text-sm truncate">
                  {row.username}
                  {isMe && <span className="text-white/40"> (you)</span>}
                </span>
                <span className="text-sm shrink-0" style={{ fontFamily: "var(--font-display)" }}>
                  {row.correct}-{row.graded - row.correct}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
