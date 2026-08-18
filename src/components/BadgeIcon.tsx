import { badgeGradient } from "@/lib/colorUtils";

// Shared shape/sizing recipe for every non-level badge - same rounded-full,
// size-driven padding/font-size scale, and display font as LevelBadge, so
// any badge sits at the same height as one another no matter what icon or
// color it uses. Any future badge should render through this component
// (icon + a single catalog color) rather than inventing its own look.
const SIZE_DIMS = {
  xs: "text-[7px] px-1 py-[1px]",
  sm: "text-[11px] px-2 py-1",
  lg: "text-sm px-2.5 py-1",
};

export function BadgeIcon({ icon, color, size = "sm" }: { icon: string; color: string; size?: "xs" | "sm" | "lg" }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${SIZE_DIMS[size]}`}
      style={{
        fontFamily: "var(--font-display)",
        background: badgeGradient(color),
        boxShadow: `0 0 10px -3px ${color}`,
      }}
    >
      {icon}
    </span>
  );
}
