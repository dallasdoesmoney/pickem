// Same shape/sizing recipe as LevelBadge (rounded-full, same
// size-driven padding/font-size scale, display font, colored glow
// shadow) so it can sit directly next to a LevelBadge at the same
// height - just narrower, since there's no "LV 10"-style text, only the
// icon. Any future non-level badge should follow this same recipe
// (icon + gradient color + this exact size scale) rather than inventing
// a new visual language per badge.
const SIZE_DIMS = {
  xs: "text-[7px] px-1 py-[1px]",
  sm: "text-[11px] px-2 py-1",
  lg: "text-sm px-2.5 py-1",
};

export function CreatorBadgeIcon({ size = "sm" }: { size?: "xs" | "sm" | "lg" }) {
  return (
    <span
      title="Creator"
      className={`inline-flex items-center justify-center rounded-full font-semibold shrink-0 ${SIZE_DIMS[size]}`}
      style={{
        fontFamily: "var(--font-display)",
        background: "linear-gradient(135deg, #f87171, #dc2626)",
        boxShadow: "0 0 10px -3px #ef4444",
      }}
    >
      🎥
    </span>
  );
}
