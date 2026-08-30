"use client";

import { useEffect, useState } from "react";
import { fetchUserBadges } from "@/lib/supabase/badges";
import { badgeDef } from "@/lib/badgeCatalog";
import { BadgeIcon } from "@/components/BadgeIcon";
import { badgeGradient } from "@/lib/colorUtils";

// Every badge a profile has - Creator included - renders together here,
// in its own row under the name/username rather than crammed onto the
// name's line next to the level badge. Renders nothing until award logic
// for any of these exists and a row shows up in user_badges, so a profile
// with none just looks like today's profile.
export function PlayerBadges({ userId }: { userId: string }) {
  // Keyed by the user rather than cleared on a change of user - see the
  // same shape in CreatorLinks for why.
  const [held, setHeld] = useState<{ id: string; keys: string[] } | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchUserBadges(userId)
      .then((rows) => {
        if (!cancelled) setHeld({ id: userId, keys: rows.map((r) => r.badge_key) });
      })
      .catch(() => {
        if (!cancelled) setHeld({ id: userId, keys: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const keys = held && held.id === userId ? held.keys : null;

  if (!keys || keys.length === 0) return null;

  const openDef = openKey ? badgeDef(openKey) : null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2.5">
        {keys.map((key) => {
          const def = badgeDef(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpenKey(key)}
              aria-label={`${def.label} badge - tap to learn more`}
              className="active:scale-90 transition-transform"
            >
              <BadgeIcon icon={def.icon} color={def.color} size="lg" />
            </button>
          );
        })}
      </div>

      {openDef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpenKey(null)} />
          <div className="relative w-full max-w-xs rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 text-center">
            <span
              className="inline-flex h-14 w-14 rounded-full items-center justify-center text-2xl mb-3"
              style={{ background: badgeGradient(openDef.color) }}
            >
              {openDef.icon}
            </span>
            <h2 className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
              {openDef.label.toUpperCase()}
            </h2>
            <p className="text-sm text-white/60 mt-2">{openDef.description}</p>
            <button
              type="button"
              onClick={() => setOpenKey(null)}
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
