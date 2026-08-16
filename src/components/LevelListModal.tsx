"use client";

import { useEffect, useRef } from "react";
import { ALL_LEVELS, subLevelRoman } from "@/lib/levels";

// Same overlay/panel language as PlayerProfileModal, but the body scrolls
// internally (50 rows) instead of the panel growing past the viewport.
export function LevelListModal({ open, currentLevel, onClose }: { open: boolean; currentLevel?: number; onClose: () => void }) {
  const currentRowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) currentRowRef.current?.scrollIntoView({ block: "center" });
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl shadow-black/50 flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            ALL LEVELS
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-4 flex flex-col gap-1">
          {ALL_LEVELS.map((entry) => {
            const isCurrent = entry.level === currentLevel;
            return (
              <div
                key={entry.level}
                ref={isCurrent ? currentRowRef : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isCurrent ? "border" : ""}`}
                style={isCurrent ? { borderColor: entry.rankColor, background: `${entry.rankColor}1a` } : undefined}
              >
                <span className="text-lg shrink-0 w-6 text-center">{entry.rankEmoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="text-sm block truncate" style={{ color: entry.rankColor, fontFamily: "var(--font-display)" }}>
                    {entry.rankName} {subLevelRoman(entry.subLevel)}
                  </span>
                  <span className="text-[11px] text-white/40">Level {entry.level}</span>
                </span>
                <span className="text-right shrink-0">
                  <span className="text-sm block" style={{ fontFamily: "var(--font-display)" }}>
                    {entry.cumulativePoints.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-white/40">total pts</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
