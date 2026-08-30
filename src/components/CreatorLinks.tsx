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
  // KEYED BY THE USER, rather than cleared when the user changes.
  //
  // The clear was doing something real - without it the previous
  // creator's links stay on screen while the new fetch is in flight - but
  // it was a setState in the effect body, so every change of userId cost
  // a second render before the fetch had even started. Holding the id
  // alongside the value answers the same question at render time: what I
  // have belongs to somebody, and it only counts if that somebody is who
  // is being asked about now.
  const [held, setHeld] = useState<{ id: string; links: CreatorLink[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCreatorLinks(userId)
      .then((rows) => {
        if (!cancelled) setHeld({ id: userId, links: rows });
      })
      .catch(() => {
        if (!cancelled) setHeld({ id: userId, links: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const links = held && held.id === userId ? held.links : null;

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
