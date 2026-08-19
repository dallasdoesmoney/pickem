"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import posthog from "posthog-js";
import { TierTemplate, resolveItem } from "@/data/tierTemplates";
import { TierListState, rankedCount, sanitizeState, tierLabelFor } from "@/lib/tierList";
import { fetchTierListShare } from "@/lib/supabase/tierLists";
import { fetchProfilesByIds } from "@/lib/supabase/leaderboard";
import { Suspense } from "react";
import TierListPageClient from "@/app/tier-lists/[list]/TierListPageClient";
import { RouteLoading } from "@/components/RouteLoading";

// A shared snapshot is read-only by construction: it renders from the
// fetched row and never writes back. "Make Your Own" swaps in the full
// editor seeded with a COPY, so edits land in the visitor's own local
// list and can't reach the original row.
export default function SharedTierListClient({ template, code }: { template: TierTemplate; code: string }) {
  const [status, setStatus] = useState<"loading" | "missing" | "error" | "ready">("loading");
  const [snapshot, setSnapshot] = useState<TierListState | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchTierListShare(code)
      .then(async (row) => {
        if (cancelled) return;
        if (!row) {
          setStatus("missing");
          return;
        }
        const clean = sanitizeState(row.state, template);
        if (!clean) {
          setStatus("error");
          return;
        }
        setSnapshot({ ...clean, title: row.title || clean.title });
        setStatus("ready");
        if (row.user_id) {
          try {
            const profiles = await fetchProfilesByIds([row.user_id]);
            const p = profiles.get(row.user_id);
            if (!cancelled && p) setAuthor(p.display_name || p.username);
          } catch {
            // Attribution is a nicety - a failed lookup just renders the
            // list without a name on it.
          }
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [code, template]);

  const chipSize = 44;
  const ranked = useMemo(() => (snapshot ? rankedCount(snapshot) : 0), [snapshot]);

  if (cloning && snapshot) {
    // Deliberately a fresh copy - the editor persists to the visitor's
    // own localStorage key under their own control.
    // Same Suspense requirement as the editor route: TierListPageClient
    // reads the query string through useSearchParams.
    return (
      <Suspense fallback={<RouteLoading label="Tier List" />}>
        <TierListPageClient template={template} initialState={{ ...snapshot, title: `${snapshot.title} (my version)` }} snapshotAuthor={author} />
      </Suspense>
    );
  }

  if (status === "loading") {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-4xl w-full mx-auto">
        <div className="flex justify-center pt-16">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      </main>
    );
  }

  if (status !== "ready" || !snapshot) {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-md w-full mx-auto text-center">
        <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>
          {status === "missing" ? "LINK NOT FOUND" : "SOMETHING WENT WRONG"}
        </h1>
        <p className="text-white/50 text-sm mt-3">
          {status === "missing"
            ? "This tier list link doesn't exist, or it was never finished being created."
            : "We couldn't load this tier list. Try again in a moment."}
        </p>
        <Link
          href={`/tier-lists/${template.slug}`}
          className="inline-block mt-6 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
        >
          BUILD YOUR OWN
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 pb-16 pt-8 max-w-4xl w-full mx-auto">
      <header className="text-center mb-6">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW &middot; TIER LIST</div>
        <h1 className="text-[clamp(1.75rem,7vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          {snapshot.title.toUpperCase()}
        </h1>
        <p className="text-white/50 text-sm mt-2">
          {author ? `Ranked by ${author}` : "Someone's take"} &middot; {ranked}/{template.items.length} ranked
        </p>
      </header>

      <div className="flex flex-col gap-2">
        {snapshot.tiers.map((tier, i) => {
          const ids = snapshot.placements[tier.id] ?? [];
          return (
            <div
              key={tier.id}
              className="flex items-stretch rounded-2xl overflow-hidden border"
              style={{ borderColor: "rgba(255,255,255,0.10)", background: `${tier.accent}14` }}
            >
              <div
                className="shrink-0 flex items-center justify-center px-1 py-2"
                style={{ width: 64, background: `${tier.accent}26`, borderRight: `2px solid ${tier.accent}` }}
              >
                <span
                  className="text-center leading-none break-all"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: tier.accent,
                    fontSize: tierLabelFor(tier, i).length > 4 ? 13 : 22,
                  }}
                >
                  {tierLabelFor(tier, i)}
                </span>
              </div>
              <div className="flex-1 min-w-0 p-2 flex flex-wrap gap-1.5 content-start" style={{ minHeight: chipSize + 16 }}>
                {ids.map((id) => {
                  const item = resolveItem(template, id);
                  return (
                    <span
                      key={id}
                      title={item.label}
                      aria-label={item.label}
                      className="rounded-xl flex items-center justify-center border border-white/10"
                      style={{ width: chipSize, height: chipSize, background: `${item.accent}2e` }}
                    >
                      <img src={item.imageUrl} alt="" crossOrigin="anonymous" className="w-[78%] h-[78%] object-contain" />
                    </span>
                  );
                })}
                {ids.length === 0 && <span className="self-center text-[11px] text-white/28 px-1">EMPTY</span>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-center gap-3 mt-8">
        <button
          type="button"
          onClick={() => {
            setCloning(true);
            posthog.capture("tier_list_cloned", { template: template.slug, code });
          }}
          className="rounded-full px-7 py-3.5 text-lg active:scale-95 transition-transform duration-150"
          style={{
            fontFamily: "var(--font-display)",
            background: "linear-gradient(135deg, #4ade80, #22c55e)",
            color: "#0e1b33",
            boxShadow: "0 4px 20px rgba(74,222,128,0.35)",
          }}
        >
          MAKE YOUR OWN 🏈
        </button>
        <p className="text-white/40 text-xs">Starts from this list. Your changes won&rsquo;t touch theirs.</p>
      </div>
    </main>
  );
}
