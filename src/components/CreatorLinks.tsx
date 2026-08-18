"use client";

import { useEffect, useState } from "react";
import { fetchCreatorLinks, CreatorLink } from "@/lib/supabase/creatorLinks";
import { SOCIAL_PLATFORM_CATALOG } from "@/lib/socialPlatforms";

// Same "renders nothing until there's something to show" shape as
// PlayerBadges - a non-creator profile (the vast majority) just has zero
// rows, so this is a no-op there rather than needing to check the
// Creator badge first.
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
        const def = SOCIAL_PLATFORM_CATALOG[link.platform] ?? { label: link.platform, icon: "🔗" };
        return (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10 hover:border-white/25 transition-colors"
          >
            <span>{def.icon}</span>
            {def.label}
          </a>
        );
      })}
    </div>
  );
}
