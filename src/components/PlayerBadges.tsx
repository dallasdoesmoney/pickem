"use client";

import { useEffect, useState } from "react";
import { fetchUserBadges } from "@/lib/supabase/badges";
import { badgeDef } from "@/lib/badgeCatalog";

// Renders nothing until award logic for any of these exists and a row
// shows up in user_badges - no empty-state placeholder, so a profile
// with none just looks like today's profile.
export function PlayerBadges({ userId }: { userId: string }) {
  const [keys, setKeys] = useState<string[] | null>(null);

  useEffect(() => {
    setKeys(null);
    fetchUserBadges(userId)
      .then((rows) => setKeys(rows.map((r) => r.badge_key)))
      .catch(() => setKeys([]));
  }, [userId]);

  if (!keys || keys.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2">
      {keys.map((key) => {
        const def = badgeDef(key);
        return (
          <span
            key={key}
            title={def.label}
            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
            style={{ fontFamily: "var(--font-display)", color: def.color, borderColor: `${def.color}55`, background: `${def.color}1a` }}
          >
            <span>{def.icon}</span>
            {def.label}
          </span>
        );
      })}
    </div>
  );
}
