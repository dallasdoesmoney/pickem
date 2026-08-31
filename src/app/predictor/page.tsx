"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TEAMS_SORTED, TeamAbbr } from "@/data/teams";
import { REQUIRED_PREDICTOR_WEEKS } from "@/lib/teamSchedule";
import { useAuth } from "@/hooks/useAuth";
import { fetchPredictorProgress } from "@/lib/supabase/achievements";

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default function PredictorLandingPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<Partial<Record<TeamAbbr, number>> | null>(null);

  useEffect(() => {
    if (!user) {
      setProgress(null);
      return;
    }
    fetchPredictorProgress(user.id)
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [user]);

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-4xl w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">TEAM PICK&rsquo;EM</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK A TEAM
        </h1>
        <p className="text-white/50 text-sm mt-3">Predict every game on their schedule and see how you stack up against Vegas.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {TEAMS_SORTED.map((team) => {
          const required = REQUIRED_PREDICTOR_WEEKS[team.abbr] ?? 0;
          const filled = progress?.[team.abbr] ?? 0;
          const done = user && filled >= required && required > 0;
          return (
            <Link
              key={team.abbr}
              href={`/predictor/${team.abbr.toLowerCase()}`}
              className={`flex flex-col items-center gap-3 rounded-2xl border transition-colors px-4 py-6 ${
                done ? "border-emerald-400 bg-emerald-400/10" : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25"
              }`}
            >
              <div className="relative">
                <img src={team.logo} alt="" className="h-14 w-14 object-contain" crossOrigin="anonymous" />
                {done && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-400 flex items-center justify-center">
                    <CheckIcon className="h-3 w-3 text-[#0e1b33]" />
                  </span>
                )}
              </div>
              <span className="text-sm text-center leading-tight" style={{ fontFamily: "var(--font-display)" }}>
                {team.city}
                <br />
                {team.name}
              </span>
              {user && (done || filled > 0) && (
                <span className={`text-[10px] ${done ? "text-emerald-300" : "text-white/40"}`}>
                  {done ? "Complete" : `${filled}/${required} weeks`}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
