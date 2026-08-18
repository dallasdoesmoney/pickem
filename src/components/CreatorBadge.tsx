"use client";

import { useEffect, useState } from "react";
import { fetchCreatorUserIds } from "@/lib/supabase/badges";
import { CreatorBadgeIcon } from "@/components/CreatorBadgeIcon";
import { BADGE_CATALOG } from "@/lib/badgeCatalog";

// Self-contained, like PlayerBadges - drop it right next to a LevelBadge
// in any header and it renders nothing until the user actually has the
// badge. Separate from PlayerBadges (the "other" badges row further
// down the profile) since this one belongs beside the level badge, not
// underneath the username.
export function CreatorBadge({ userId, size = "lg" }: { userId: string; size?: "xs" | "sm" | "lg" }) {
  const [hasCreator, setHasCreator] = useState<boolean | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);

  useEffect(() => {
    setHasCreator(null);
    fetchCreatorUserIds([userId])
      .then((ids) => setHasCreator(ids.has(userId)))
      .catch(() => setHasCreator(false));
  }, [userId]);

  if (!hasCreator) return null;

  const def = BADGE_CATALOG.creator;

  return (
    <>
      <button
        type="button"
        onClick={() => setExplainerOpen(true)}
        aria-label={`${def.label} badge - tap to learn more`}
        className="active:scale-90 transition-transform"
      >
        <CreatorBadgeIcon size={size} />
      </button>

      {explainerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setExplainerOpen(false)} />
          <div className="relative w-full max-w-xs rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 text-center">
            <span
              className="inline-flex h-14 w-14 rounded-full items-center justify-center text-2xl mb-3"
              style={{ background: "linear-gradient(135deg, #f87171, #dc2626)" }}
            >
              {def.icon}
            </span>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {def.label.toUpperCase()}
            </h2>
            <p className="text-sm text-white/60 mt-2">This account streams or makes content about Sideline Brew.</p>
            <button
              type="button"
              onClick={() => setExplainerOpen(false)}
              className="mt-5 w-full rounded-full px-5 py-2.5 text-sm border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              GOT IT
            </button>
          </div>
        </div>
      )}
    </>
  );
}
