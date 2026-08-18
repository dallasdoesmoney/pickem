// Catalog of non-level badges (see src/lib/levels.ts for the level badge,
// which is computed rather than stored). These are looked up by the
// badge_key stored in user_badges - award logic for most of them doesn't
// exist yet (this just defines how a badge_key renders once one is
// granted), except 'creator' which review_creator_request() actually
// writes (see src/app/admin/page.tsx).
export type BadgeDef = { label: string; icon: string; color: string };

export const BADGE_CATALOG: Record<string, BadgeDef> = {
  streak_3: { label: "3-Week Streak", icon: "🔥", color: "#fb923c" },
  streak_10: { label: "10-Week Streak", icon: "🔥", color: "#f87171" },
  youtube_member: { label: "Channel Member", icon: "📺", color: "#f472b6" },
  creator: { label: "Creator", icon: "🎥", color: "#ef4444" },
};

export function badgeDef(key: string): BadgeDef {
  return BADGE_CATALOG[key] ?? { label: key, icon: "🏅", color: "#94a3b8" };
}
