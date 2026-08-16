"use client";

import { useState } from "react";

// Generic collapsed/expanded shell for one achievement category. The
// expanded body (team grid, week list, whatever a future achievement
// needs) is passed in as children rather than made generic here - the
// instances differ too much category to category to be worth one shared
// instance renderer.
export function AchievementCard({
  icon,
  label,
  description,
  pointsEach,
  pointsLabel = "PTS EACH",
  unitLabel,
  doneCount,
  totalCount,
  children,
}: {
  icon: string;
  label: string;
  description: string;
  pointsEach: number;
  pointsLabel?: string;
  unitLabel: string;
  doneCount: number;
  totalCount?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const uncapped = totalCount === undefined;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 p-4 text-left">
        <span className="text-3xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {label}
            </h2>
            <span className="text-[10px] text-emerald-400" style={{ fontFamily: "var(--font-display)" }}>
              {pointsEach} {pointsLabel}
            </span>
          </div>
          <p className="text-xs text-white/50 mt-0.5">{description}</p>

          <div className="mt-2.5">
            <div className="flex items-center justify-between text-xs text-white/50 mb-1">
              <span>
                {uncapped ? `${doneCount} ${unitLabel}` : `${doneCount} / ${totalCount} ${unitLabel}`}
              </span>
              <span style={{ fontFamily: "var(--font-display)" }}>{doneCount * pointsEach} pts</span>
            </div>
            {!uncapped && (
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-400" style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }} />
              </div>
            )}
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 mt-1.5 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
