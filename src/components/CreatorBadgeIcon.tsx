import { BadgeIcon } from "@/components/BadgeIcon";
import { BADGE_CATALOG } from "@/lib/badgeCatalog";

// Thin convenience wrapper around the generic BadgeIcon for the one spot
// that still needs a standalone creator chip outside the full badges row -
// leaderboard rows, which do their own bulk creator-id fetch rather than
// paying for PlayerBadges' full per-user badge fetch on every row.
export function CreatorBadgeIcon({ size = "sm" }: { size?: "xs" | "sm" | "lg" }) {
  const def = BADGE_CATALOG.creator;
  return (
    <span title={def.label}>
      <BadgeIcon icon={def.icon} color={def.color} size={size} />
    </span>
  );
}
