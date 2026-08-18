"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import {
  CollisionDetection,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { TierItem, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { MAX_TIERS, MAX_TITLE, TierListState, findItemTier, rankedCount, tierLabelFor } from "@/lib/tierList";
import { useTierList } from "@/hooks/useTierList";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { supabase } from "@/lib/supabase/client";
import { createTierListShare, fetchMyTierList, saveTierList } from "@/lib/supabase/tierLists";
import { renderTierShareImage } from "@/lib/tierShareImage";
import { shareBlob } from "@/lib/shareBlob";
import { buildReferralLink } from "@/lib/referralStorage";
import { TierItemChip, SortableTierItem } from "@/components/tierList/TierItemChip";
import { TierRow } from "@/components/tierList/TierRow";
import { RankSheet } from "@/components/tierList/RankSheet";
import { ShareDialog } from "@/components/tierList/ShareDialog";

const PENDING_SAVE_KEY = "pickem:pending-save-intent";

export default function TierListPageClient({
  template,
  initialState,
  snapshotAuthor,
  readOnlySnapshot,
}: {
  template: TierTemplate;
  // Present when arriving from a share link - seeds the editor with
  // someone else's list ("Make Your Own") instead of local state.
  initialState?: TierListState;
  snapshotAuthor?: string | null;
  readOnlySnapshot?: boolean;
}) {
  const { state, loaded, dispatch, replace, undo, redo, canUndo, canRedo } = useTierList(template);
  const { user, profile } = useAuth();
  const { requestSignIn, signInModal } = useSignInModal();
  const { confirm, dialog } = useConfirmDialog();

  const [viewportWidth, setViewportWidth] = useState(390);
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetItem, setSheetItem] = useState<TierItem | null>(null);
  const [landedId, setLandedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const dbLoadedFor = useRef<string | null>(null);
  // Bumped per drag so a drag's many intermediate moves coalesce into one
  // undo step, without merging into the *previous* drag of the same item.
  const dragSession = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => {
    function measure() {
      setViewportWidth(window.innerWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Seed from a shared snapshot exactly once, after local state has
  // hydrated so it isn't immediately overwritten by the effect in the hook.
  const seeded = useRef(false);
  useEffect(() => {
    if (!loaded || !initialState || seeded.current) return;
    seeded.current = true;
    replace(initialState);
  }, [loaded, initialState, replace]);

  // Pull a saved list down, but ONLY over a pristine local list. The rest
  // of the app treats the DB as authoritative; here that would throw away
  // a list someone just built signed-out, which is the exact work the
  // sign-in prompt is trying to preserve.
  useEffect(() => {
    if (!loaded || !user || initialState) return;
    if (dbLoadedFor.current === user.id) return;
    dbLoadedFor.current = user.id;
    if (rankedCount(state) > 0) return;
    fetchMyTierList(user.id, template.slug)
      .then((row) => {
        if (row?.state) replace({ ...row.state, template: template.slug });
      })
      .catch((err) => console.error("Failed to load saved tier list", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user, template.slug, initialState]);

  const isCompact = viewportWidth < 768;
  const ranked = rankedCount(state);
  const total = template.items.length;
  const complete = ranked === total;

  // Solve chip size from real available width so two columns of logos
  // never overflow a 320px phone.
  const { chipSize } = useMemo(() => {
    const content = Math.min(viewportWidth, 896) - 32;
    const track = content - 64 - 16;
    const perRow = viewportWidth < 400 ? 5 : viewportWidth < 768 ? 7 : 10;
    const size = Math.floor((track - (perRow - 1) * 6) / perRow);
    return { chipSize: Math.max(34, Math.min(58, size)) };
  }, [viewportWidth]);

  const sensors = useSensors(
    // Mouse needs a few px of travel so a plain click still selects.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Touch needs a hold, otherwise every attempt to scroll the page
    // would grab a logo instead. Tap-to-rank is the primary path here;
    // drag is the secondary one.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const flashLanded = useCallback((id: string) => {
    setLandedId(id);
    setTimeout(() => setLandedId((cur) => (cur === id ? null : cur)), 340);
  }, []);

  // pointerWithin tracks the actual cursor, which is what makes dropping
  // into a big empty tier row feel predictable. It returns nothing for the
  // keyboard sensor (no pointer), so closestCenter backs it up.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const hits = pointerWithin(args);
    return hits.length ? hits : closestCenter(args);
  }, []);

  function containerOf(overId: string): { tier: string | null } | null {
    if (overId === "unranked") return { tier: null };
    if (overId.startsWith("tier:")) return { tier: overId.slice(5) };
    // Over another item - inherit that item's container.
    const t = findItemTier(state, overId);
    if (t) return { tier: t };
    if (state.unranked.includes(overId)) return { tier: null };
    return null;
  }

  function applyMove(activeId: string, overId: string, flash: boolean) {
    const target = containerOf(overId);
    if (!target) return;

    const list = target.tier === null ? state.unranked : state.placements[target.tier] ?? [];
    const overIsItem = !overId.startsWith("tier:") && overId !== "unranked";
    const index = overIsItem ? list.indexOf(overId) : null;

    const from = findItemTier(state, activeId);
    const already = from === target.tier;
    // Nothing to do if it's already sitting exactly where it would land.
    if (already && (index === null || list[index] === activeId)) return;

    dispatch({
      type: "moveItem",
      itemId: activeId,
      toTier: target.tier,
      toIndex: index,
      mergeToken: `${activeId}:${dragSession.current}`,
    });
    if (flash && target.tier !== null) flashLanded(activeId);
  }

  // Live repositioning while dragging. Without this the list sat frozen
  // until the pointer was released, which read as the drag not working at
  // all on desktop - on mobile it goes unnoticed because tap-to-rank is
  // the primary path there.
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    applyMove(String(active.id), String(over.id), false);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    // The pointerup that ends a drag also fires a click on the chip
    // underneath, which would immediately select (desktop) or open the
    // sheet (touch) on whatever was just dropped.
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = e;
    if (!over) return;
    applyMove(String(active.id), String(over.id), true);
  }

  function handleItemActivate(item: TierItem) {
    if (suppressClick.current) return;
    if (isCompact) {
      setSheetItem(item);
      return;
    }
    // Desktop: click to select, click a tier to place. The keyboard- and
    // mouse-accessible alternative to dragging.
    setSelectedId((cur) => (cur === item.id ? null : item.id));
  }

  function placeSelected(tierId: string | null) {
    if (!selectedId) return;
    dispatch({ type: "moveItem", itemId: selectedId, toTier: tierId, toIndex: null });
    if (tierId !== null) flashLanded(selectedId);
    setSelectedId(null);
  }

  function pickFromSheet(tierId: string) {
    if (!sheetItem) return;
    dispatch({ type: "moveItem", itemId: sheetItem.id, toTier: tierId, toIndex: null });
    flashLanded(sheetItem.id);
    setSheetItem(null);
  }

  async function handleDeleteTier(tierId: string, label: string) {
    const count = (state.placements[tierId] ?? []).length;
    if (count > 0) {
      const ok = await confirm(
        `Delete the ${label} tier? The ${count} ${count === 1 ? template.itemNoun[0] : template.itemNoun[1]} in it go back to Unranked.`,
        "DELETE TIER"
      );
      if (!ok) return;
    }
    dispatch({ type: "deleteTier", tierId });
  }

  async function handleReset() {
    if (await confirm("Reset this tier list back to a blank slate?", "RESET")) {
      dispatch({ type: "reset", template });
      posthog.capture("tier_list_reset", { template: template.slug });
    }
  }

  const doSave = useCallback(
    async (userId: string, next: TierListState) => {
      const { error } = await saveTierList(userId, next);
      if (error) {
        setSaveError(error);
        return;
      }
      setSaveError(null);
      setSavedAt(Date.now());
      posthog.capture("tier_list_saved", { template: template.slug, ranked: rankedCount(next) });
    },
    [template.slug]
  );

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      let userId = user?.id;
      if (!userId) {
        const signedIn = await requestSignIn();
        if (!signedIn) {
          setSaving(false);
          return;
        }
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user.id;
      }
      // No userId means the sign-in was a Google redirect - the effect
      // below finishes the save once the page reloads with a session.
      if (!userId) return;
      await doSave(userId, state);
    } finally {
      setSaving(false);
    }
  }

  // Resume a save that was interrupted by the Google OAuth round trip.
  // The local list survives in localStorage, so there's nothing to
  // rebuild by the time this runs.
  useEffect(() => {
    if (!user || !loaded) return;
    if (sessionStorage.getItem(PENDING_SAVE_KEY) !== "1") return;
    sessionStorage.removeItem(PENDING_SAVE_KEY);
    doSave(user.id, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loaded]);

  async function confirmIfIncomplete() {
    if (complete) return true;
    const left = total - ranked;
    return confirm(
      `You still have ${left} unranked ${left === 1 ? template.itemNoun[0] : template.itemNoun[1]}.`,
      "SHARE ANYWAY",
      "KEEP RANKING"
    );
  }

  async function handleOpenShare() {
    if (!(await confirmIfIncomplete())) return;
    setShareUrl(null);
    setShareOpen(true);
  }

  async function handleShareImage() {
    const blob = await renderTierShareImage({
      state,
      template,
      authorLabel: profile?.display_name || profile?.username || null,
    });
    await shareBlob({
      blob,
      filename: `${template.slug}-tier-list.png`,
      title: template.title,
      text: `${state.title}\n\n${buildReferralLink(profile?.username)}`,
      onShared: (method) => posthog.capture("tier_list_shared", { template: template.slug, method, ranked }),
    });
  }

  async function handleCreateLink() {
    const { code, error } = await createTierListShare(state);
    if (error || !code) return null;
    const url = `${window.location.origin}/tier-lists/${template.slug}/share/${code}`;
    setShareUrl(url);
    posthog.capture("tier_list_link_created", { template: template.slug, ranked });
    return url;
  }

  // Desktop undo/redo. Skipped while typing in a tier name or the title
  // so the browser's own text undo still works there.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const activeItem = draggingId ? resolveItem(template, draggingId) : null;

  if (!loaded) {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-4xl w-full mx-auto">
        <div className="flex justify-center pt-16">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 pb-16 pt-8 max-w-4xl w-full mx-auto">
      <header className="text-center mb-6">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW &middot; TIER LIST</div>
        <h1 className="text-[clamp(1.75rem,7vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          {template.title.toUpperCase()}
        </h1>
        <p className="text-white/50 text-sm mt-2">{template.tagline}</p>

        <ProgressBar ranked={ranked} total={total} complete={complete} />

        {readOnlySnapshot && snapshotAuthor && (
          <p className="text-white/45 text-xs mt-2">
            Originally ranked by <span className="text-white/70">{snapshotAuthor}</span>
          </p>
        )}
      </header>

      {/* Title. Editable in place - no modal for a single text field. */}
      <div className="flex justify-center mb-5">
        <input
          value={state.title}
          onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })}
          maxLength={MAX_TITLE}
          aria-label="Tier list title"
          placeholder={template.defaultListTitle}
          className="w-full max-w-sm text-center rounded-xl border border-white/10 hover:border-white/25 focus:border-white/40 bg-white/5 px-4 py-2 text-white text-sm outline-none transition-colors placeholder:text-white/30"
          style={{ fontFamily: "var(--font-display)" }}
        />
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(e: DragStartEvent) => {
          dragSession.current += 1;
          setDraggingId(String(e.active.id));
          setSelectedId(null);
        }}
        onDragOver={handleDragOver}
        onDragCancel={() => setDraggingId(null)}
        onDragEnd={handleDragEnd}
      >
        {/* Solid panel behind the whole board. The site paints a tiled
            logo watermark at the page level, and letting it show through
            the tier rows made the list read as a translucent overlay
            rather than the thing you're actually working on. */}
        <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#101f3d] p-2">
          {state.tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              index={i}
              itemIds={state.placements[tier.id] ?? []}
              template={template}
              chipSize={chipSize}
              editing={editing}
              selectedItemId={selectedId}
              landedItemId={landedId}
              isDropTarget={!!selectedId}
              canMoveUp={i > 0}
              canMoveDown={i < state.tiers.length - 1}
              canDelete={state.tiers.length > 1}
              onRename={(label) => dispatch({ type: "renameTier", tierId: tier.id, label })}
              onMove={(direction) => dispatch({ type: "moveTier", tierId: tier.id, direction })}
              onDelete={() => handleDeleteTier(tier.id, tierLabelFor(tier, i))}
              onItemActivate={handleItemActivate}
              onPlaceSelected={() => placeSelected(tier.id)}
            />
          ))}
        </div>

        {editing && (
          <button
            type="button"
            onClick={() => dispatch({ type: "addTier" })}
            disabled={state.tiers.length >= MAX_TIERS}
            className="w-full mt-2 rounded-2xl border border-dashed border-white/20 hover:border-white/40 text-white/50 hover:text-white/80 py-3 text-xs transition-colors disabled:opacity-30"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {state.tiers.length >= MAX_TIERS ? `MAX ${MAX_TIERS} TIERS` : "+ ADD TIER"}
          </button>
        )}

        <UnrankedPool
          ids={state.unranked}
          template={template}
          chipSize={chipSize}
          selectedItemId={selectedId}
          landedItemId={landedId}
          onItemActivate={handleItemActivate}
          onPlaceSelected={() => placeSelected(null)}
          onShuffle={() => dispatch({ type: "shuffleUnranked" })}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem ? <TierItemChip item={activeItem} size={chipSize * 1.15} /> : null}
        </DragOverlay>
      </DndContext>

      {selectedId && !isCompact && (
        <p className="text-center text-xs text-white/50 mt-3">
          Now click a tier to drop <span className="text-white/80">{resolveItem(template, selectedId).label}</span> in — or press Esc to cancel.
        </p>
      )}

      {/* Controls. Deliberately below the list and visually quiet - they
          support the ranking, they aren't the point of the page. */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <GhostButton onClick={undo} disabled={!canUndo} label="Undo">
          UNDO
        </GhostButton>
        <GhostButton onClick={redo} disabled={!canRedo} label="Redo">
          REDO
        </GhostButton>
        <GhostButton onClick={() => setEditing((v) => !v)} label="Toggle tier editing" active={editing}>
          {editing ? "DONE EDITING" : "EDIT TIERS"}
        </GhostButton>
        <GhostButton onClick={handleReset} label="Reset tier list">
          RESET
        </GhostButton>
      </div>

      <div className="flex justify-center mt-5">
        <button
          type="button"
          onClick={handleOpenShare}
          className="flex items-center gap-2 rounded-full px-7 py-3.5 text-lg active:scale-95 transition-transform duration-150"
          style={{
            fontFamily: "var(--font-display)",
            background: "linear-gradient(135deg, #4ade80, #22c55e)",
            color: "#0e1b33",
            boxShadow: "0 4px 20px rgba(74,222,128,0.35)",
          }}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="M7 8l5-5 5 5" />
            <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
          SHARE MY TIER LIST 🏈
        </button>
      </div>

      <div className="flex flex-col items-center mt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 h-9 rounded-full px-6 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-60"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #34d399, #059669)", color: "#ffffff" }}
        >
          {saving ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              SAVING&hellip;
            </>
          ) : savedAt ? (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              SAVED
            </>
          ) : (
            "SAVE MY TIER LIST"
          )}
        </button>
        {saveError && <p className="text-xs text-red-400 mt-2">{saveError}</p>}
      </div>

      <RankSheet
        item={sheetItem}
        tiers={state.tiers}
        currentTierId={sheetItem ? findItemTier(state, sheetItem.id) : null}
        onPick={pickFromSheet}
        onUnrank={() => {
          if (!sheetItem) return;
          dispatch({ type: "moveItem", itemId: sheetItem.id, toTier: null, toIndex: null });
          setSheetItem(null);
        }}
        onClose={() => setSheetItem(null)}
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShareImage={handleShareImage}
        onCreateLink={handleCreateLink}
        shareUrl={shareUrl}
      />

      {dialog}
      {signInModal}
    </main>
  );
}

function ProgressBar({ ranked, total, complete }: { ranked: number; total: number; complete: boolean }) {
  return (
    <div className="mt-4 max-w-xs mx-auto">
      <div className="flex items-baseline justify-center gap-2">
        <span
          className="text-2xl leading-none transition-colors duration-300"
          style={{ fontFamily: "var(--font-display)", color: complete ? "#4ade80" : "#ffffff" }}
        >
          {ranked}/{total}
        </span>
        <span className="text-xs text-white/45 tracking-wide">RANKED</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 mt-2 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width,background] duration-300"
          style={{
            width: `${(ranked / total) * 100}%`,
            background: complete ? "linear-gradient(90deg,#4ade80,#22c55e)" : "linear-gradient(90deg,#fbbf24,#4ade80)",
          }}
        />
      </div>
      {complete && (
        <p className="text-xs mt-2" style={{ fontFamily: "var(--font-display)", color: "#4ade80" }}>
          YOUR HIERARCHY IS COMPLETE.
        </p>
      )}
    </div>
  );
}

function UnrankedPool({
  ids,
  template,
  chipSize,
  selectedItemId,
  landedItemId,
  onItemActivate,
  onPlaceSelected,
  onShuffle,
}: {
  ids: string[];
  template: TierTemplate;
  chipSize: number;
  selectedItemId: string | null;
  landedItemId: string | null;
  onItemActivate: (item: TierItem) => void;
  onPlaceSelected: () => void;
  onShuffle: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "unranked" });
  const items = ids.map((id) => resolveItem(template, id));

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-2 px-0.5">
        <h2 className="text-sm text-white/70 tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          UNRANKED <span className="text-white/35">({ids.length})</span>
        </h2>
        <button
          type="button"
          onClick={onShuffle}
          disabled={ids.length < 2}
          aria-label="Shuffle unranked"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] border border-white/15 hover:border-white/30 text-white/60 hover:text-white transition-colors disabled:opacity-30"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 3h5v5" />
            <path d="M4 20L21 3" />
            <path d="M21 16v5h-5" />
            <path d="M15 15l6 6" />
            <path d="M4 4l5 5" />
          </svg>
          SHUFFLE
        </button>
      </div>

      <div
        ref={setNodeRef}
        onClick={selectedItemId ? onPlaceSelected : undefined}
        className="rounded-2xl border p-2.5 flex flex-wrap gap-1.5 content-start transition-colors duration-150"
        style={{
          minHeight: chipSize + 20,
          borderColor: isOver ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.10)",
          // Opaque, same as the tier board above it.
          background: isOver ? "#16294d" : "#101f3d",
          cursor: selectedItemId ? "pointer" : undefined,
        }}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          {items.map((item) => (
            <SortableTierItem
              key={item.id}
              item={item}
              size={chipSize}
              selected={selectedItemId === item.id}
              landed={landedItemId === item.id}
              onActivate={() => onItemActivate(item)}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <span className="self-center text-[11px] tracking-wide text-white/30 px-1">
            EVERY {template.itemNoun[0].toUpperCase()} IS RANKED
          </span>
        )}
      </div>
    </section>
  );
}

function GhostButton({
  onClick,
  disabled,
  label,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={`rounded-full px-4 py-2 text-xs border transition-colors disabled:opacity-30 ${
        active
          ? "border-white/50 text-white bg-white/10"
          : "border-white/15 hover:border-white/30 text-white/70 hover:text-white"
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {children}
    </button>
  );
}
