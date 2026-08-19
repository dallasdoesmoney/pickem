"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TierTemplate, getTierTemplate } from "@/data/tierTemplates";
import { BoardThumb, previewFor } from "@/components/tierList/BoardThumb";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
  SavedTierListSummary,
  deleteTierList,
  fetchTierListRankCounts,
  listMyTierLists,
} from "@/lib/supabase/tierLists";

type Tab = "all" | "mine";

// Coarse on purpose: "when did I last touch this" only needs to be right
// to the day, and an exact timestamp reads as clutter on a card.
function whenTouched(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Exact up to a thousand, then one decimal: 999, 1k, 1.4k, 15.4k, 115.3k,
// 1.1M. The decimal is dropped when it would read ".0", so a round
// thousand is "1k" rather than "1.0k".
function abbreviate(n: number): string {
  if (n < 1000) return String(n);
  const [value, suffix] = n < 1_000_000 ? [n / 1000, "k"] : [n / 1_000_000, "M"];
  const rounded = Math.floor(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}${suffix}`;
}

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

const CARD =
  "group flex flex-col rounded-2xl border border-white/15 bg-[#101d38] overflow-hidden transition-colors hover:border-white/40";

function TemplateCard({ template, people }: { template: TierTemplate; people?: number }) {
  const preview = useMemo(() => previewFor(template), [template]);
  return (
    <Link href={`/tier-lists/${template.slug}`} className={CARD}>
      <span className="block p-2.5 pb-0">
        <BoardThumb state={preview} template={template} />
      </span>
      <span className="flex flex-col gap-1 p-3">
        <span className="text-[12.5px] leading-tight" style={{ fontFamily: "var(--font-display)" }}>
          {template.title.toUpperCase()}
        </span>
        <span className="text-[11.5px] text-white/45 leading-snug">{template.tagline}</span>
        {/* Hidden at zero rather than shown as "0 RANKED" - a counter is
            social proof, and an empty one is the opposite. */}
        {!!people && (
          <span
            className="text-[10px] tracking-[0.14em] text-white/40 mt-0.5"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {abbreviate(people)} RANKED
          </span>
        )}
      </span>
    </Link>
  );
}

function SavedCard({
  row,
  template,
  busy,
  onDelete,
}: {
  row: SavedTierListSummary;
  template: TierTemplate | null;
  busy: boolean;
  onDelete: () => void;
}) {
  return (
    <div className={`${CARD} relative`}>
      <Link href={`/tier-lists/${row.template}?id=${row.id}`} className="flex flex-col">
        <span className="block p-2.5 pb-0">
          {template ? (
            <BoardThumb state={row.state} template={template} />
          ) : (
            <span className="block rounded-lg bg-black/60" style={{ height: 70 }} />
          )}
        </span>
        <span className="flex flex-col gap-1 p-3 pr-10">
          <span className="text-[12.5px] leading-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
            {row.title.toUpperCase()}
          </span>
          <span className="text-[11.5px] text-white/45">saved {whenTouched(row.updated_at)}</span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        aria-label={`Delete ${row.title}`}
        className="absolute bottom-2 right-2 h-8 w-8 rounded-full text-white/35 hover:text-red-300 hover:bg-red-300/10 flex items-center justify-center transition-colors disabled:opacity-40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16" />
          <path d="M10 11v6M14 11v6" />
          <path d="M6 7l1 13h10l1-13" />
          <path d="M9 7V4h6v3" />
        </svg>
      </button>
    </div>
  );
}

export default function TierListsIndexClient({ templates }: { templates: TierTemplate[] }) {
  const { user, loading: authLoading } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const { confirm, dialog } = useConfirmDialog();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [saved, setSaved] = useState<SavedTierListSummary[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (userId: string) => {
    try {
      setSaved(await listMyTierLists(userId));
      setLoadError(null);
    } catch (err) {
      console.error("Failed to load saved tier lists", err);
      setLoadError("Couldn't load your saved lists. Try again.");
    }
  }, []);

  useEffect(() => {
    if (!user) {
      // Signed out - nothing to fetch, and leaving the previous user's
      // lists on screen after a sign-out would be a leak.
      setSaved(null);
      return;
    }
    load(user.id);
  }, [user, load]);

  // Public: the counter shows for signed-out visitors too.
  useEffect(() => {
    fetchTierListRankCounts().then(setCounts);
  }, []);

  const shownTemplates = useMemo(
    () => (query ? templates.filter((t) => matches(`${t.title} ${t.tagline}`, query)) : templates),
    [templates, query],
  );

  const shownSaved = useMemo(() => {
    const rows = saved ?? [];
    if (!query) return rows;
    return rows.filter((r) => matches(`${r.title} ${getTierTemplate(r.template)?.title ?? r.template}`, query));
  }, [saved, query]);

  async function handleDelete(row: SavedTierListSummary) {
    if (!user) return;
    const ok = await confirm(`Delete "${row.title}"? This can't be undone.`, "DELETE");
    if (!ok) return;
    setBusyId(row.id);
    const { error } = await deleteTierList(user.id, row.id);
    setBusyId(null);
    if (error) {
      setLoadError(error);
      return;
    }
    setSaved((rows) => (rows ?? []).filter((r) => r.id !== row.id));
  }

  const savedCount = saved?.length ?? null;
  // Two up on a phone, three from large screens - a single column made
  // the page a long scroll of near-identical cards.
  const grid = "grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4";

  return (
    <main className="flex-1 px-4 pb-16 pt-8 max-w-5xl w-full mx-auto">
      <header className="text-center mb-7">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1.5">SIDELINE BREW</div>
        <h1
          className="text-[clamp(1.75rem,7vw,3rem)] leading-none tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          TIER LISTS
        </h1>
        <p className="text-sm text-white/50 mt-3">Rank it, name it, argue about it.</p>
      </header>

      {/* Search above the toggle: it narrows whichever set you're looking
          at, so it belongs to the page rather than to either tab. */}
      <div className="relative mb-3">
        <svg
          viewBox="0 0 24 24"
          className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tier lists"
          aria-label="Search tier lists"
          // Solid fill, not a wash over the page background, and 16px so
          // iOS doesn't zoom the page on focus.
          className="w-full rounded-full border border-white/15 bg-[#101d38] pl-11 pr-11 py-3 text-base text-white placeholder:text-white/35 outline-none focus:border-white/45 transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full text-white/45 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>

      {/* Both halves carry a real fill - the selected one lighter than the
          page, the other darker - so the control reads as a switch rather
          than as text floating on the background. */}
      <div className="flex gap-2 mb-6" role="tablist">
        {([
          ["all", "ALL TIER LISTS", shownTemplates.length],
          ["mine", "MY TIER LISTS", savedCount],
        ] as const).map(([id, label, count]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-full py-3 px-3 text-[11px] sm:text-sm border transition-colors ${
                active
                  ? "bg-[#2b4173] border-white/35 text-white"
                  : "bg-[#0a1428] border-white/12 text-white/55 hover:text-white hover:border-white/25"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              <span className="truncate">{label}</span>
              {typeof count === "number" && (
                <span
                  className={`shrink-0 rounded-full px-1.5 text-[10px] ${
                    active ? "bg-white/20 text-white" : "bg-white/10 text-white/50"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === "all" ? (
        shownTemplates.length === 0 ? (
          <p className="text-sm text-white/45 text-center py-14">Nothing matches &ldquo;{query}&rdquo;.</p>
        ) : (
          <div className={grid}>
            {shownTemplates.map((t) => (
              <TemplateCard key={t.slug} template={t} people={counts[t.slug]} />
            ))}
          </div>
        )
      ) : authLoading || (user && saved === null) ? (
        <div className="flex justify-center py-14">
          <span className="h-6 w-6 rounded-full border-2 border-white/25 border-t-white animate-spin" />
        </div>
      ) : !user ? (
        <div className="rounded-2xl border border-white/15 bg-[#101d38] p-8 text-center">
          <p className="text-sm text-white/60">Sign in to save tier lists and pick them back up later.</p>
          <button
            type="button"
            onClick={() => requestSignIn()}
            className="mt-4 rounded-full px-6 py-2.5 text-sm active:scale-95 transition-transform duration-150"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, #34d399, #059669)",
              color: "#ffffff",
            }}
          >
            SIGN IN
          </button>
        </div>
      ) : shownSaved.length === 0 ? (
        <div className="rounded-2xl border border-white/15 bg-[#101d38] p-8 text-center flex flex-col items-center gap-4">
          <p className="text-sm text-white/60">
            {query ? `Nothing matches “${query}”.` : "Nothing saved yet. Build one and hit Save."}
          </p>
          {!query && (
            <button
              type="button"
              onClick={() => setTab("all")}
              className="rounded-full px-6 py-2.5 text-sm border border-white/20 hover:border-white/40 text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              BROWSE TIER LISTS
            </button>
          )}
        </div>
      ) : (
        <div className={grid}>
          {shownSaved.map((row) => (
            <SavedCard
              key={row.id}
              row={row}
              template={getTierTemplate(row.template)}
              busy={busyId === row.id}
              onDelete={() => handleDelete(row)}
            />
          ))}
        </div>
      )}

      {loadError && <p className="text-xs text-red-400 mt-5 text-center">{loadError}</p>}

      {signInModal}
      {dialog}
    </main>
  );
}
