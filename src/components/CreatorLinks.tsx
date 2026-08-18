"use client";

import { useEffect, useState } from "react";
import { fetchCreatorLinks, CreatorLink } from "@/lib/supabase/creatorLinks";
import { SOCIAL_PLATFORM_CATALOG } from "@/lib/socialPlatforms";
import { SOCIAL_ICON_COMPONENTS } from "@/components/SocialIcon";

// Same "renders nothing until there's something to show" shape as
// PlayerBadges - a non-creator profile (the vast majority) just has zero
// rows, so this is a no-op there rather than needing to check the
// Creator badge first. Each link is just the platform's logo mark on
// its brand color, no visible label - the color+shape alone reads as
// "this is a real social icon," same language as the Creator badge.
export function CreatorLinks({ userId }: { userId: string }) {
  const [links, setLinks] = useState<CreatorLink[] | null>(null);

  useEffect(() => {
    setLinks(null);
    fetchCreatorLinks(userId)
      .then(setLinks)
      .catch(() => setLinks([]));
  }, [userId]);

  if (!links || links.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
      {links.map((link) => {
        const def = SOCIAL_PLATFORM_CATALOG[link.platform];
        const Icon = SOCIAL_ICON_COMPONENTS[link.platform];
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            title={def?.label ?? link.platform}
            aria-label={def?.label ?? link.platform}
            className="h-8 w-8 rounded-full flex items-center justify-center border border-white/15 hover:brightness-110 active:scale-90 transition"
            style={{ background: def?.color ?? "#64748b" }}
          >
            {Icon ? <Icon className="h-4 w-4 text-white" /> : <span className="text-white text-xs">🔗</span>}
          </a>
        );
      })}
    </div>
  );
}
