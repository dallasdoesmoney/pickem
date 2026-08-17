import { getLevelInfo, subLevelRoman } from "@/lib/levels";

// Hidden entirely below level 1 (under 1,500 points) - nothing to show
// off yet, and it doubles as the incentive to cross that first threshold.
export function LevelBadge({ totalPoints, size = "sm" }: { totalPoints: number; size?: "sm" | "lg" }) {
  const info = getLevelInfo(totalPoints);
  if (info.isUnranked) return null;

  const dims = size === "sm" ? "text-[11px] px-2 py-1" : "text-sm px-2.5 py-1";

  return (
    <span
      title={`${info.rankName} ${subLevelRoman(info.subLevel)} · Level ${info.level}`}
      className={`inline-flex items-center gap-1 rounded-full font-semibold shrink-0 ${dims}`}
      style={{
        fontFamily: "var(--font-display)",
        background: info.rankColor,
        color: "#06121f",
        boxShadow: `0 0 10px -3px ${info.rankColor}`,
      }}
    >
      <span>{info.rankEmoji}</span>
      LV {info.level}
    </span>
  );
}
