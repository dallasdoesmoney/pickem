"use client";

import { useState } from "react";

// Generic collapsed/expanded shell for one achievement category. The
// expanded body (team grid, week list, whatever a future achievement
// needs) is passed in as children rather than made generic here - the
// instances differ too much category to category to be worth one shared
// instance renderer.
//
// Collapsed state is deliberately lean: label, a thin progress bar, and
// a points figure - the description and the "how much have I actually
// earned" detail (mostly restating what the label already implies) live
// in the expanded body instead, since that's one tap away and doesn't
// need to cost height on every card just to be visible up front.
//
// The collapsed points figure is the goal, not a running total - what
// you'd earn from one completion (pointsEach), or for a fixed-size
// achievement you could realistically finish in one sitting (Season
// Predictor's 32 teams), the full potential reward (headlineValue). A
// cumulative "doneCount * pointsEach" total there read as a stat that
// changed meaning depending on how far along you were, rather than a
// fixed goal to aim at - that total still shows up in the expanded body.
//
// "Complete" (done >= total, capped achievements only) is derived here
// from doneCount/totalCount rather than passed in - callers that also
// need to know completeness for list ordering compute the same
// comparison themselves rather than threading a prop back out.
// neverComplete opts a capped-looking achievement (Lock of the Week's
// "X/Y locks this season" isn't a fixed ceiling - Y grows every week)
// out of the checkmark/dim/sort-to-bottom treatment despite having a
// totalCount, since it can never be permanently "done."
export function AchievementCard({
  icon,
  label,
  description,
  pointsEach,
  pointsLabel = "PTS EACH",
  headlineValue,
  unitLabel,
  doneCount,
  totalCount,
  neverComplete = false,
  note,
  children,
}: {
  icon: string;
  label: string;
  description: string;
  pointsEach: number;
  pointsLabel?: string;
  headlineValue?: number;
  unitLabel: string;
  doneCount: number;
  totalCount?: number;
  neverComplete?: boolean;
  // A short live status for the collapsed row - "Checked in today", a
  // streak. Only worth using where the state changes without the user
  // doing anything, which is the one case where making them expand the
  // card to find out would be hiding the point of it.
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const uncapped = totalCount === undefined;
  const complete = !uncapped && !neverComplete && totalCount > 0 && doneCount >= totalCount;
  const pct = !uncapped && totalCount > 0 ? Math.min((doneCount / totalCount) * 100, 100) : 0;
  const headline = headlineValue ?? pointsEach;

  return (
    <div
      className={`rounded-2xl border overflow-hidden transition-opacity ${
        complete ? "border-white/5 bg-white/[0.03] opacity-60" : "border-white/10 bg-white/5"
      }`}
    >
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2.5 p-3 text-left">
        <span className="text-xl shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <h2 className="text-sm truncate" style={{ fontFamily: "var(--font-display)" }}>
                {label}
              </h2>
              {complete && (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-400 shrink-0" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              )}
            </div>
            <span className="text-xs shrink-0 text-emerald-400 tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {headline.toLocaleString()} pts
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {!uncapped ? (
              <>
                <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[10px] text-white/40 shrink-0 tabular-nums whitespace-nowrap">
                  {doneCount}/{totalCount} {unitLabel}
                </span>
              </>
            ) : (
              <span className="text-[10px] text-white/40 tabular-nums">
                {doneCount} {unitLabel}
              </span>
            )}
            {note && <span className="text-[10px] shrink-0 whitespace-nowrap">{note}</span>}
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="px-3.5 pb-3.5">
          <p className="text-xs text-white/50">
            {description}{" "}
            <span className="text-white/35">
              &middot; {pointsEach} {pointsLabel.toLowerCase()} &middot; {(doneCount * pointsEach).toLocaleString()} pts earned so far
            </span>
          </p>
          <div className="mt-2">{children}</div>
        </div>
      )}
    </div>
  );
}
