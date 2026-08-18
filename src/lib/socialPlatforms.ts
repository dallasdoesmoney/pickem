// Catalog of platforms a Creator can link on their public profile - keep
// in sync with the `platform` check constraint on creator_links in
// supabase/schema.sql. icon here is only used for the picker dropdown in
// SocialLinksModal - the public-facing display (CreatorLinks) uses the
// real logo marks in SocialIcon.tsx instead, on a `color`-filled circle.
export type SocialPlatformDef = { label: string; icon: string; color: string };

export const SOCIAL_PLATFORM_CATALOG: Record<string, SocialPlatformDef> = {
  twitch: { label: "Twitch", icon: "🟣", color: "#9146FF" },
  youtube: { label: "YouTube", icon: "▶️", color: "#FF0000" },
  twitter: { label: "X / Twitter", icon: "✖️", color: "#000000" },
  instagram: { label: "Instagram", icon: "📸", color: "#E4405F" },
  tiktok: { label: "TikTok", icon: "🎵", color: "#000000" },
  kick: { label: "Kick", icon: "🟢", color: "#53FC18" },
  website: { label: "Website", icon: "🔗", color: "#64748b" },
};
