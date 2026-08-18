// Catalog of non-level badges (see src/lib/levels.ts for the level badge,
// which is computed rather than stored). These are looked up by the
// badge_key stored in user_badges - award logic for most of them doesn't
// exist yet (this just defines how a badge_key renders once one is
// granted), except 'creator' which review_creator_request() actually
// writes (see src/app/admin/page.tsx).
export type BadgeDef = { label: string; icon: string; color: string; description: string };

export const BADGE_CATALOG: Record<string, BadgeDef> = {
  streak_3: { label: "3-Week Streak", icon: "🔥", color: "#fb923c", description: "Correctly picked at least one game 3 weeks in a row." },
  streak_10: { label: "10-Week Streak", icon: "🔥", color: "#f87171", description: "Correctly picked at least one game 10 weeks in a row." },
  youtube_member: { label: "Channel Member", icon: "📺", color: "#f472b6", description: "A member of the Sideline Brew YouTube channel." },
  creator: { label: "Creator", icon: "🎥", color: "#ef4444", description: "This account streams or makes content about Sideline Brew." },
};

export function badgeDef(key: string): BadgeDef {
  return BADGE_CATALOG[key] ?? { label: key, icon: "🏅", color: "#94a3b8", description: "" };
}
