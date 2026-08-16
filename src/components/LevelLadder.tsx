"use client";

import { useEffect, useRef } from "react";
import { ALL_LEVELS, RANKS, LEVELS_PER_RANK, subLevelRoman } from "@/lib/levels";

// 10 chunks of 5 - one per rank, in RANKS order.
const RANK_GROUPS = RANKS.map((_, i) => ALL_LEVELS.slice(i * LEVELS_PER_RANK, (i + 1) * LEVELS_PER_RANK));

function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// The ladder content only - no modal chrome - so it can be dropped into
// LevelListModal (viewing someone else) or LevelsAchievementsModal
// (viewing your own, with the levels/achievements toggle) without
// duplicating the rendering. Renders as 10 rank "tiers," each a row of 5
// pips (not 50 flat rows) - achieved pips fill solid, the current one
// glows, future ones sit dim behind a lock, so the whole thing reads as a
// track you're climbing rather than a price list.
export function LevelLadder({ currentLevel }: { currentLevel?: number }) {
  const currentRankRef = useRef<HTMLDivElement>(null);
  const hasProgress = currentLevel !== undefined && currentLevel > 0;
  const currentEntry = hasProgress ? ALL_LEVELS[currentLevel! - 1] : undefined;

  useEffect(() => {
    currentRankRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return (
    <>
      {currentEntry && (
        <div
          className="rounded-2xl p-3.5 flex items-center gap-3 shrink-0"
          style={{ background: `linear-gradient(135deg, ${currentEntry.rankColor}2e, ${currentEntry.rankColor}0d)`, border: `1px solid ${currentEntry.rankColor}55` }}
        >
          <span
            className="h-12 w-12 rounded-full flex items-center justify-center text-2xl shrink-0"
            style={{ background: `${currentEntry.rankColor}26`, boxShadow: `0 0 20px -4px ${currentEntry.rankColor}` }}
          >
            {currentEntry.rankEmoji}
          </span>
          <div className="min-w-0">
            <div className="text-[10px] text-white/45 tracking-wide">CURRENT RANK</div>
            <div className="text-lg truncate" style={{ color: currentEntry.rankColor, fontFamily: "var(--font-display)" }}>
              {currentEntry.rankName} {subLevelRoman(currentEntry.subLevel)}
            </div>
            <div className="text-[11px] text-white/40">
              Level {currentEntry.level} of {ALL_LEVELS.length}
            </div>
          </div>
        </div>
      )}

      {RANK_GROUPS.map((group, i) => {
        const rank = RANKS[i];
        const isCurrentRank = hasProgress && currentLevel! >= group[0].level && currentLevel! <= group[group.length - 1].level;
        return (
          <div key={rank.name} ref={isCurrentRank ? currentRankRef : undefined}>
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center text-base shrink-0"
                style={{ background: `${rank.color}22`, border: `1px solid ${rank.color}55` }}
              >
                {rank.emoji}
              </span>
              <div className="min-w-0">
                <div className="text-sm" style={{ color: rank.color, fontFamily: "var(--font-display)" }}>
                  {rank.name}
                </div>
                <div className="text-[10px] text-white/35 tabular-nums">
                  {group[0].cumulativePoints.toLocaleString()} – {group[group.length - 1].cumulativePoints.toLocaleString()} pts
                </div>
              </div>
            </div>

            <div className="flex gap-1.5">
              {group.map((entry) => {
                const achieved = hasProgress && entry.level < currentLevel!;
                const isCurrent = entry.level === currentLevel;
                const locked = hasProgress && entry.level > currentLevel!;
                const lit = achieved || isCurrent || !hasProgress;

                return (
                  <div
                    key={entry.level}
                    title={`Level ${entry.level} · ${entry.cumulativePoints.toLocaleString()} total pts`}
                    className="flex-1 rounded-lg py-2 flex flex-col items-center justify-center gap-0.5 transition-opacity"
                    style={{
                      background: lit ? `${rank.color}22` : "rgba(255,255,255,0.03)",
                      border: `1px solid ${lit ? `${rank.color}66` : "rgba(255,255,255,0.08)"}`,
                      boxShadow: isCurrent ? `0 0 0 2px ${rank.color}, 0 0 16px -2px ${rank.color}` : undefined,
                      opacity: locked ? 0.45 : 1,
                    }}
                  >
                    <span className="text-xs" style={{ fontFamily: "var(--font-display)", color: lit ? rank.color : "rgba(255,255,255,0.4)" }}>
                      {subLevelRoman(entry.subLevel)}
                    </span>
                    {achieved ? (
                      <CheckIcon className="h-3 w-3" style={{ color: rank.color }} />
                    ) : locked ? (
                      <LockIcon className="h-3 w-3 text-white/30" />
                    ) : (
                      <span className="text-[9px] text-white/30">{entry.level}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
