"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TierTemplate, getTierTemplate } from "@/data/tierTemplates";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { SavedTierListSummary, deleteTierList, listMyTierLists } from "@/lib/supabase/tierLists";

// Coarse on purpose: "when did I last touch this" only needs to be right
// to the day, and an exact timestamp reads as clutter in a list.
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

export default function TierListsIndexClient({ templates }: { templates: TierTemplate[] }) {
  const { user, loading: authLoading } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const { confirm, dialog } = useConfirmDialog();

  const [saved, setSaved] = useState<SavedTierListSummary[] | null>(null);
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
      // Signed out - there is nothing to fetch, and leaving the previous
      // user's lists on screen after a sign-out would be a leak.
      setSaved(null);
      return;
    }
    load(user.id);
  }, [user, load]);

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

      <section className="mb-10">
        <h2 className="text-sm tracking-[0.18em] text-white/45 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          START A NEW ONE
        </h2>
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <Link
              key={t.slug}
              href={`/tier-lists/${t.slug}`}
              className="group rounded-2xl border border-white/15 hover:border-white/35 bg-[#0b1730] p-5 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
                    {t.title.toUpperCase()}
                  </div>
                  <p className="text-sm text-white/50 mt-1">{t.tagline}</p>
                </div>
                <span className="text-white/35 group-hover:text-white/70 transition-colors shrink-0 text-sm">
                  {t.items.length} {t.itemNoun[1]}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm tracking-[0.18em] text-white/45 mb-3" style={{ fontFamily: "var(--font-display)" }}>
          MY SAVED TIER LISTS
        </h2>

        {/* Auth resolves a beat after mount; without this the signed-out
            prompt flashes in front of people who are in fact signed in. */}
        {authLoading ? (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          </div>
        ) : !user ? (
          <div className="rounded-2xl border border-white/15 bg-[#0b1730] p-6 text-center">
            <p className="text-sm text-white/60">Sign in to save tier lists and pick them back up later.</p>
            <button
              type="button"
              onClick={() => requestSignIn()}
              className="mt-4 rounded-full px-5 py-2 text-sm active:scale-95 transition-transform duration-150"
              style={{
                fontFamily: "var(--font-display)",
                background: "linear-gradient(135deg, #34d399, #059669)",
                color: "#ffffff",
              }}
            >
              SIGN IN
            </button>
          </div>
        ) : saved === null ? (
          <div className="flex justify-center py-8">
            <span className="h-5 w-5 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          </div>
        ) : saved.length === 0 ? (
          <div className="rounded-2xl border border-white/15 bg-[#0b1730] p-6 text-center">
            <p className="text-sm text-white/60">
              Nothing saved yet. Build one above and hit Save and it&rsquo;ll show up here.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {saved.map((row) => {
              const template = getTierTemplate(row.template);
              return (
                <li
                  key={row.id}
                  className="rounded-2xl border border-white/15 bg-[#0b1730] p-4 flex items-center justify-between gap-3"
                >
                  <Link href={`/tier-lists/${row.template}?id=${row.id}`} className="min-w-0 flex-1 group">
                    <div
                      className="truncate group-hover:text-white transition-colors"
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {row.title.toUpperCase()}
                    </div>
                    <p className="text-xs text-white/45 mt-1">
                      {/* A saved list whose category no longer exists still
                          has to render something, so fall back to the slug. */}
                      {(template?.title ?? row.template)} &middot; saved {whenTouched(row.updated_at)}
                    </p>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    disabled={busyId === row.id}
                    aria-label={`Delete ${row.title}`}
                    className="shrink-0 h-9 w-9 rounded-full border border-white/15 text-white/50 hover:text-red-300 hover:border-red-300/40 flex items-center justify-center transition-colors disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7h16" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M6 7l1 13h10l1-13" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {loadError && <p className="text-xs text-red-400 mt-3 text-center">{loadError}</p>}
      </section>

      {signInModal}
      {dialog}
    </main>
  );
}
