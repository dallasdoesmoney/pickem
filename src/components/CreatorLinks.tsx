"use client";

import { useEffect, useState } from "react";
import { fetchCreatorLinks, CreatorLink } from "@/lib/supabase/creatorLinks";
import { SOCIAL_PLATFORM_CATALOG } from "@/lib/socialPlatforms";
import { SOCIAL_ICON_COMPONENTS } from "@/components/SocialIcon";

// Same "renders nothing until there's something to show" shape as
// PlayerBadges - a non-creator profile (the vast majority) just has zero
// rows, so this is a no-op there rather than needing to check the
// Creator badge first. Plain logo marks, no background chip - just the
// icon, same weight as any other inline icon in the app.
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
    <div className="flex flex-wrap items-center justify-center gap-4 mt-2.5">
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
            className="text-white/65 hover:text-white active:scale-90 transition"
          >
            {Icon ? <Icon className="h-6 w-6" /> : <span className="text-lg">🔗</span>}
          </a>
        );
      })}
    </div>
  );
}
