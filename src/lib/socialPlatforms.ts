// Catalog of platforms a Creator can link on their public profile - keep
// in sync with the `platform` check constraint on creator_links in
// supabase/schema.sql. Same {label, icon} shape as badgeCatalog.ts.
export type SocialPlatformDef = { label: string; icon: string };

export const SOCIAL_PLATFORM_CATALOG: Record<string, SocialPlatformDef> = {
  twitch: { label: "Twitch", icon: "🟣" },
  youtube: { label: "YouTube", icon: "▶️" },
  twitter: { label: "X / Twitter", icon: "✖️" },
  instagram: { label: "Instagram", icon: "📸" },
  tiktok: { label: "TikTok", icon: "🎵" },
  kick: { label: "Kick", icon: "🟢" },
  website: { label: "Website", icon: "🔗" },
};
