"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TierTemplate, getTierTemplate } from "@/data/tierTemplates";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { MenuIcon, TierListMenu } from "@/components/tierList/TierListMenu";
import { SavedTierListSummary, deleteTierList, listMyTierLists } from "@/lib/supabase/tierLists";

// Coarse on purpose: "when did I last touch this" only needs to be right
// to the day, and an exact timestamp reads as clutter in a menu row.
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

function matches(haystack: string, query: string): boolean {
  return haystack.toLowerCase().includes(query.trim().toLowerCase());
}

export default function TierListsIndexClient({ templates }: { templates: TierTemplate[] }) {
  const { user, loading: authLoading } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const { confirm, dialog } = useConfirmDialog();

  const [saved, setSaved] = useState<SavedTierListSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Only one menu open at a time - two overlapping panels anchored to
  // adjacent buttons would sit on top of each other.
  const [openMenu, setOpenMenu] = useState<"start" | "saved" | null>(null);
  const [startQuery, setStartQuery] = useState("");
  const [savedQuery, setSavedQuery] = useState("");

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

  const shownTemplates = useMemo(
    () => (startQuery ? templates.filter((t) => matches(`${t.title} ${t.tagline}`, startQuery)) : templates),
    [templates, startQuery],
  );

  const shownSaved = useMemo(() => {
    const rows = saved ?? [];
    if (!savedQuery) return rows;
    return rows.filter((r) => matches(`${r.title} ${getTierTemplate(r.template)?.title ?? r.template}`, savedQuery));
  }, [saved, savedQuery]);

  async function handleDelete(row: SavedTierListSummary) {
    if (!user) return;
    // Close first: the confirm dialog renders outside the panel, so the
    // menu's own outside-click would tear it down mid-question anyway.
    setOpenMenu(null);
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

  return (
    <main className="flex-1 px-4 pb-16 pt-8 max-w-3xl w-full mx-auto">
      <header className="text-center mb-8">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1.5">SIDELINE BREW</div>
        <h1
          className="text-[clamp(1.75rem,7vw,3rem)] leading-none tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          TIER LISTS
        </h1>
        <p className="text-sm text-white/50 mt-3">Rank it, name it, argue about it.</p>
      </header>

      <div className="flex flex-col sm:flex-row gap-3">
        <TierListMenu
          label="TIER LISTS"
          open={openMenu === "start"}
          onOpenChange={(next) => {
            setOpenMenu(next ? "start" : null);
            if (!next) setStartQuery("");
          }}
          query={startQuery}
          onQueryChange={setStartQuery}
          searchPlaceholder="Search tier lists"
        >
          {shownTemplates.length === 0 ? (
            <p className="px-3 py-4 text-sm text-white/45 text-center">Nothing matches that.</p>
          ) : (
            shownTemplates.map((t) => (
              <Link
                key={t.slug}
                href={`/tier-lists/${t.slug}`}
                role="menuitem"
                onClick={() => setOpenMenu(null)}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-white/5 transition-colors"
              >
                <MenuIcon src={t.icon} />
                <span className="min-w-0">
                  <span className="block text-sm truncate" style={{ fontFamily: "var(--font-display)" }}>
                    {t.title.toUpperCase()}
                  </span>
                  <span className="block text-xs text-white/45 truncate">{t.tagline}</span>
                </span>
              </Link>
            ))
          )}
        </TierListMenu>

        <TierListMenu
          label="MY TIER LISTS"
          badge={savedCount}
          open={openMenu === "saved"}
          onOpenChange={(next) => {
            setOpenMenu(next ? "saved" : null);
            if (!next) setSavedQuery("");
          }}
          // Only once there is something to search: the panel otherwise
          // holds a sign-in prompt or an empty state, and a filter box
          // above either of those is a control that can do nothing.
          query={user && (saved?.length ?? 0) > 0 ? savedQuery : undefined}
          onQueryChange={user && (saved?.length ?? 0) > 0 ? setSavedQuery : undefined}
          searchPlaceholder="Search your lists"
        >
          {authLoading || (user && saved === null) ? (
            <div className="flex justify-center py-6">
              <span className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
            </div>
          ) : !user ? (
            <div className="px-3 py-4 text-center">
              <p className="text-sm text-white/60">Sign in to save tier lists and pick them back up later.</p>
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(null);
                  requestSignIn();
                }}
                className="mt-3 rounded-full px-5 py-2 text-sm active:scale-95 transition-transform duration-150"
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
            <p className="px-3 py-4 text-sm text-white/45 text-center">
              {savedQuery ? "Nothing matches that." : "Nothing saved yet. Build one and hit Save."}
            </p>
          ) : (
            shownSaved.map((row) => {
              const template = getTierTemplate(row.template);
              return (
                <div key={row.id} className="flex items-center gap-1 rounded-xl hover:bg-white/5 transition-colors">
                  <Link
                    href={`/tier-lists/${row.template}?id=${row.id}`}
                    role="menuitem"
                    onClick={() => setOpenMenu(null)}
                    className="flex items-center gap-3 px-3 py-2.5 min-w-0 flex-1"
                  >
                    <MenuIcon src={template?.icon} />
                    <span className="min-w-0">
                      <span className="block text-sm truncate" style={{ fontFamily: "var(--font-display)" }}>
                        {row.title.toUpperCase()}
                      </span>
                      <span className="block text-xs text-white/45 truncate">
                        {/* A saved list whose category no longer exists
                            still has to render, so fall back to the slug. */}
                        {template?.title ?? row.template} &middot; saved {whenTouched(row.updated_at)}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={busyId === row.id}
                    aria-label={`Delete ${row.title}`}
                    className="shrink-0 mr-2 h-8 w-8 rounded-full text-white/40 hover:text-red-300 hover:bg-red-300/10 flex items-center justify-center transition-colors disabled:opacity-40"
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
            })
          )}
        </TierListMenu>
      </div>

      {loadError && <p className="text-xs text-red-400 mt-4 text-center">{loadError}</p>}

      {signInModal}
      {dialog}
    </main>
  );
}
