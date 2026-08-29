"use client";

import { CARD_EDGE, FIELD, GREEN, INK, MUTED, RULE, TEXT } from "@/lib/nameplateTheme";
import type { NameplateStats } from "@/lib/supabase/nameplateStats";

// FOUR NUMBERS AND A SHAPE.
//
// The four are the ones somebody actually wants: how often do I get it,
// am I on a run, what is my record, and how sharp am I when I do get it.
// Everything else this could show - boards played, longest drought, days
// since - is context, and context goes underneath a number rather than
// beside it competing for the same glance.
//
// The distribution below them is not a fifth KPI. It is what makes the
// average legible: 3.4 could be a pile of 3s or an even spread, and
// those are different players.

// Rounded here rather than in SQL, so the percentage and the "12 of 15"
// it sits above can never disagree about the same two numbers.
function pct(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function avg(a: number | null): string {
  if (a === null) return "—";
  // One decimal. Two is a precision nobody has earned after a fortnight
  // of boards, and a whole number hides the difference between 3.1 and
  // 3.9, which is most of the interesting range.
  return a.toFixed(1);
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 py-3"
      style={{ background: FIELD, border: CARD_EDGE }}
    >
      <span
        className="text-[9px] font-semibold uppercase leading-none tracking-[0.13em]"
        style={{ color: MUTED }}
      >
        {label}
      </span>
      <span
        className="text-[22px] leading-none sm:text-[26px]"
        style={{ fontFamily: "var(--font-display)", color: TEXT, fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
      {/* Reserved whether or not there is a sub-line, so four tiles in a
          row keep one baseline instead of stepping. */}
      <span
        className="text-[10px] leading-none"
        style={{ color: MUTED, fontVariantNumeric: "tabular-nums", minHeight: 10 }}
      >
        {sub ?? ""}
      </span>
    </div>
  );
}

export function NameplateStatsPanel({
  stats,
  // The guess this board was solved on, when the panel is shown right
  // after a solve. Its bar is lit, so the number you just earned is
  // findable in your own history rather than being a bar like any other.
  highlight,
  className,
}: {
  stats: NameplateStats;
  highlight?: number | null;
  className?: string;
}) {
  const buckets = Array.from({ length: stats.maxGuesses }, (_, i) => i + 1);
  const counts = buckets.map((n) => stats.distribution[String(n)] ?? 0);
  const most = Math.max(1, ...counts);
  const nothingYet = stats.played === 0;

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile
          label="Win rate"
          value={pct(stats.winRate)}
          sub={nothingYet ? undefined : `${stats.won} of ${stats.played}`}
        />
        {/* BOARDS, not days. A streak counts games you played and
            solved, so missing a Tuesday does not cost you one - see
            0060_puzzle_epoch.sql. Saying "days" here would be a promise
            the number does not keep. */}
        <Tile
          label="Streak"
          value={String(stats.currentStreak)}
          // Only once it is running. "0 in a row" is a sentence about
          // nothing, and it is the tile somebody with a broken streak is
          // already looking at.
          sub={stats.currentStreak > 0 ? "in a row" : undefined}
        />
        <Tile
          label="Best streak"
          value={String(stats.maxStreak)}
          sub={stats.maxStreak > 0 ? "in a row" : undefined}
        />
        <Tile label="Avg guesses" value={avg(stats.avgGuesses)} sub={nothingYet ? undefined : "when solved"} />
      </div>

      {/* Hidden until there is a shape to show. Eight empty bars under
          four dashes is a lot of furniture for somebody who has not
          finished a board. */}
      {!nothingYet && stats.won > 0 && (
        <div className="mt-3">
          <p
            className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.13em]"
            style={{ color: MUTED }}
          >
            Solved in
          </p>
          <div className="flex flex-col gap-1">
            {buckets.map((n, i) => {
              const count = counts[i];
              const lit = highlight === n;
              return (
                <div key={n} className="flex items-center gap-2">
                  <span
                    className="w-3 shrink-0 text-right text-[11px] leading-none"
                    style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}
                  >
                    {n}
                  </span>
                  {/* The bar is the count, and the count is written ON
                      it - a number in a column beside the bars makes the
                      eye do two passes over the same fact. A zero bar
                      still gets a sliver of width so the row reads as a
                      row rather than as a gap. */}
                  <div
                    className="flex min-w-0 items-center justify-end rounded px-1.5 py-[3px] text-[10px] leading-none transition-[width]"
                    style={{
                      width: `${Math.max(count === 0 ? 6 : 12, (count / most) * 100)}%`,
                      background: lit ? GREEN : RULE,
                      color: lit ? INK : count > 0 ? TEXT : MUTED,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {count > 0 ? count : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
