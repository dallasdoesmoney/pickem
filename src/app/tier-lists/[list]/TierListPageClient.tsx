"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import {
  MAX_TIERS,
  MAX_TITLE,
  TierListAction,
  TierListState,
  findItemTier,
  listTitleFor,
  rankedCount,
  tierListReducer,
  tierLabelFor,
} from "@/lib/tierList";
import { useTierList } from "@/hooks/useTierList";
import { useAuth } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { supabase } from "@/lib/supabase/client";
import { createTierListShare, fetchTierList, listMyTierLists, saveTierList } from "@/lib/supabase/tierLists";
import { renderTierShareImage } from "@/lib/tierShareImage";
import { shareBlob } from "@/lib/shareBlob";
import { buildReferralLink } from "@/lib/referralStorage";
import { TierItemChip, SortableTierItem } from "@/components/tierList/TierItemChip";
import { TierRow } from "@/components/tierList/TierRow";
import { ShareDialog } from "@/components/tierList/ShareDialog";
import { NameListDialog } from "@/components/tierList/NameListDialog";
import { CelebrationVariant, TierCelebration } from "@/components/tierList/TierCelebration";

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
  const [landedId, setLandedId] = useState<string | null>(null);
  // Keyed so the overlay fully remounts each time - reusing the element
  // would leave the CSS animations already finished, and this is meant to
  // fire every single time, back to back if need be.
  const [celebration, setCelebration] = useState<{ item: TierItem; variant: CelebrationVariant; key: number } | null>(null);
  const celebrationKey = useRef(0);
  const [cascading, setCascading] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // Which container the drag is currently over. undefined = no drag,
  // null = the unranked pool, otherwise a tier id.
  const [overTier, setOverTier] = useState<string | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [namingOpen, setNamingOpen] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  // Bumped per drag so a drag's many intermediate moves coalesce into one
  // undo step, without merging into the *previous* drag of the same item.
  const dragSession = useRef(0);
  const suppressClick = useRef(false);
  // Whether the dragged item was already in the top tier when the drag
  // began. Captured at drag START because handleDragOver moves it live -
  // asking at drop time can answer "it was already there" about a move
  // this very drag just made, which silently swallows the celebration.
  const dragStartedAtTop = useRef(false);
  const dragStartedAtBottom = useRef(false);
  // Drives the reset sweep: chips fly out before the board actually clears.
  const [sweeping, setSweeping] = useState(false);
  const [scatterKey, setScatterKey] = useState(0);

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

  // Which saved row this editor is writing to. Null means the working
  // draft in localStorage, and saving it will create a new list.
  //
  const [savedId, setSavedId] = useState<string | null>(null);
  // From useSearchParams, NOT window.location read during render. On a
  // client navigation React renders the new page before the browser URL
  // commits, so reading location here returned the PREVIOUS page's query:
  // opening a saved list found no id, never fetched it, and left the last
  // list's board on screen still pointed at the last list's row. Editing
  // and saving then wrote to that other list, which is what made every
  // saved list look like the same one.
  const requestedId = useSearchParams().get("id") ?? "";

  // Open the saved list named in the URL. A snapshot seed wins over it -
  // arriving from someone else's share link is a different intent than
  // reopening your own list.
  const openedId = useRef<string | null>(null);
  useEffect(() => {
    const id = requestedId;
    if (!loaded || !user || initialState || !id) return;
    if (openedId.current === id) return;
    openedId.current = id;
    fetchTierList(user.id, id)
      .then((row) => {
        // No row means it was deleted, or the id belongs to someone else.
        // Either way this is not your list, so leave the draft alone and
        // let Save create a new one rather than silently adopting the id.
        if (!row?.state) return;
        replace({ ...row.state, template: template.slug });
        setSavedId(row.id);
      })
      .catch((err) => console.error("Failed to load saved tier list", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, user, template.slug, initialState, requestedId]);

  const wasComplete = useRef(false);
  const sawFirstState = useRef(false);
  useEffect(() => {
    if (!loaded) return;
    // Skip the first settled state so loading an already-finished list
    // doesn't set off a celebration nobody earned.
    if (!sawFirstState.current) {
      sawFirstState.current = true;
      wasComplete.current = rankedCount(state) === template.items.length;
      return;
    }
    const nowComplete = rankedCount(state) === template.items.length;
    if (nowComplete && !wasComplete.current) {
      setCascading(true);
      setTimeout(() => setCascading(false), 1400);
    }
    wasComplete.current = nowComplete;
  }, [state, loaded, template.items.length]);

  const ranked = rankedCount(state);
  const total = template.items.length;
  const complete = ranked === total;

  // Solve chip size from real available width so two columns of logos
  // never overflow a 320px phone.
  const { chipSize, railWidth } = useMemo(() => {
    // 1000 is the board's max width (max-w-[62.5rem] on the main below)
    // and is chosen, not rounded to: at a 74px chip and the wider rail
    // below it leaves a track that holds exactly ten marks with ~22px to
    // spare. It has to move in step with the rail - the rail is taken out
    // of the same width the chips run in, so widening one without the
    // other is what costs a column.
    const content = Math.min(viewportWidth, 1000) - 32;
    // The rail carries names now, not just letters, so it's held wide
    // enough for a phrase like "SUPER BOWL CONTENDER" to wrap across two
    // or three readable lines. A phone still can't spare as much as a
    // desktop can, so it gets a narrower one and wraps sooner.
    const base = viewportWidth < 768 ? 86 : 136;
    const track = content - base - 16;
    // Ten across only once the board is actually wide enough to hold ten
    // full-size marks. Widening to ten at the 768 breakpoint would have
    // paid for the extra columns out of the chip - a 13" laptop would have
    // dropped from a 70px logo to about 54 - so the tenth column waits for
    // the width that can afford it.
    const perRow =
      viewportWidth < 400 ? 5 : viewportWidth < 768 ? 7 : viewportWidth < 1000 ? 8 : 10;
    const size = Math.floor((track - (perRow - 1) * 6) / perRow);
    // Desktop earns a bigger mark than the old 58px cap allowed - this
    // page IS the logos, so they should be what you actually look at.
    // Don't raise this without re-measuring: the rail width below is
    // derived from the chip, so a bigger chip widens the rail, which eats
    // the very track the chips need and can cost a whole column.
    const chip = Math.max(34, Math.min(74, size));
    // The chevron has to read as a landscape tab, not a square - a name
    // like "SHOULD BE FIRED" needs horizontal room, and a rail narrower
    // than the row is tall looks like a stub. Held wider than the row
    // height whatever the chip size works out to be.
    const rail = Math.max(base, Math.round((chip + 16) * 1.28));
    return { chipSize: chip, railWidth: rail };
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

  const topTierId = state.tiers[0]?.id;

  // Only a genuine bottom tier counts. With a single tier the top and the
  // bottom are the same row, and a promotion should not also be a binning.
  const bottomTierId = state.tiers.length > 1 ? state.tiers[state.tiers.length - 1]?.id : undefined;

  const isInTier = useCallback(
    (s: TierListState, itemId: string, tierId: string | undefined) =>
      !!tierId && (s.placements[tierId] ?? []).includes(itemId),
    []
  );

  // Any arrival into the top tier earns it, not just the #1 slot.
  //
  // Judged on the state the whole interaction ENDS in, against whether the
  // item was already up there when it BEGAN - not on what the final move
  // did. A drag moves the item live as it goes, so the drop itself is
  // frequently a no-op even though the drag as a whole just promoted it.
  const celebrateMove = useCallback(
    (finalState: TierListState, itemId: string, wasTop: boolean, wasBottom: boolean) => {
      const variant: CelebrationVariant | null =
        !wasTop && isInTier(finalState, itemId, topTierId)
          ? "promote"
          : !wasBottom && isInTier(finalState, itemId, bottomTierId)
            ? "bin"
            : null;
      if (!variant) return;
      celebrationKey.current += 1;
      setCelebration({ item: resolveItem(template, itemId), variant, key: celebrationKey.current });
    },
    [topTierId, bottomTierId, isInTier, template]
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

  function currentTierOf(itemId: string): string | null | undefined {
    const t = findItemTier(state, itemId);
    if (t) return t;
    return state.unranked.includes(itemId) ? null : undefined;
  }

  // Returns the action it dispatched, or null when there was nothing to do,
  // so callers can work out the resulting state for themselves.
  function applyMove(activeId: string, overId: string, flash: boolean): TierListAction | null {
    const target = containerOf(overId);
    if (!target) return null;

    const list = target.tier === null ? state.unranked : state.placements[target.tier] ?? [];
    const overIsItem = !overId.startsWith("tier:") && overId !== "unranked";
    const index = overIsItem ? list.indexOf(overId) : null;

    const already = currentTierOf(activeId) === target.tier;
    // Nothing to do if it's already sitting exactly where it would land.
    if (already && (index === null || list[index] === activeId)) return null;

    const action: TierListAction = {
      type: "moveItem",
      itemId: activeId,
      toTier: target.tier,
      toIndex: index,
      mergeToken: `${activeId}:${dragSession.current}`,
    };
    dispatch(action);
    if (flash && target.tier !== null) flashLanded(activeId);
    return action;
  }

  // Two jobs while a drag is in flight.
  //
  // First, publish which container is being targeted. This can't come from
  // each row's own useDroppable().isOver, because once a row has items in
  // it dnd-kit reports the ITEM under the cursor as `over`, not the row -
  // so a row only ever lit up while it was still empty.
  //
  // Second, move the item live so it lands where you're pointing. The
  // distinction that matters is whether the cursor is over an ITEM or over
  // the empty gap of a container:
  //   - over an item -> reorder to that item's slot, in any container.
  //     This is what makes dropping BETWEEN two teams work.
  //   - over a container's gap -> only act if crossing into a new one.
  //     Re-dispatching here just thrashed the row's ordering while the
  //     cursor sat in dead space between chips.
  function handleDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over) return;
    const overId = String(over.id);
    const target = containerOf(overId);
    if (!target) return;
    setOverTier(target.tier);

    const overIsItem = !overId.startsWith("tier:") && overId !== "unranked";
    const sameContainer = currentTierOf(String(active.id)) === target.tier;
    if (!overIsItem && sameContainer) return;
    applyMove(String(active.id), overId, false);
  }

  function handleDragEnd(e: DragEndEvent) {
    setDraggingId(null);
    setOverTier(undefined);
    // The pointerup that ends a drag also fires a click on the chip
    // underneath, which would immediately select (desktop) or open the
    // sheet (touch) on whatever was just dropped.
    suppressClick.current = true;
    setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const action = applyMove(id, String(over.id), true);
    // A no-op drop still counts: the live moves during the drag may have
    // already carried this item into first place.
    celebrateMove(
      action ? tierListReducer(state, action) : state,
      id,
      dragStartedAtTop.current,
      dragStartedAtBottom.current
    );
    dragStartedAtTop.current = false;
    dragStartedAtBottom.current = false;
  }

  // One interaction on every device: tap a team to arm it, then tap the
  // tier you want it in. This replaced a mobile-only bottom sheet that
  // listed the tiers as six letter buttons - picking the row you can
  // already see beats picking its name off a list.
  function handleItemActivate(item: TierItem) {
    if (suppressClick.current) return;
    setSelectedId((cur) => (cur === item.id ? null : item.id));
  }

  function placeSelected(tierId: string | null) {
    if (!selectedId) return;
    const action: TierListAction = { type: "moveItem", itemId: selectedId, toTier: tierId, toIndex: null };
    celebrateMove(
      tierListReducer(state, action),
      selectedId,
      isInTier(state, selectedId, topTierId),
      isInTier(state, selectedId, bottomTierId)
    );
    dispatch(action);
    if (tierId !== null) flashLanded(selectedId);
    setSelectedId(null);
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
    if (!(await confirm("Reset this tier list back to a blank slate?", "RESET"))) return;
    // Sweep first, clear second. Resetting instantly gave no sense that
    // anything happened - the board just blinked and everything was gone.
    setSweeping(true);
    setTimeout(() => {
      dispatch({ type: "reset", template });
      setSweeping(false);
    }, 420);
    posthog.capture("tier_list_reset", { template: template.slug });
  }

  // Shuffle reorders instantly, which reads as nothing happening at all.
  // Bumping the key replays a scatter across the pool as the new order
  // lands underneath it.
  function handleShuffle() {
    dispatch({ type: "shuffleUnranked" });
    setScatterKey((k) => k + 1);
  }

  const doSave = useCallback(
    async (userId: string, draft: TierListState, id: string | null) => {
      // Normalised before it leaves: the title column rejects a blank,
      // and an untitled list is unidentifiable on the index anyway.
      const next = { ...draft, title: listTitleFor(draft, template) };
      const { id: rowId, error } = await saveTierList(userId, next, id);
      if (error) {
        setSaveError(error);
        return false;
      }
      setSaveError(null);
      setSavedAt(Date.now());
      if (rowId) {
        setSavedId(rowId);
        // Keep editing the same row across a refresh, and give the user a
        // URL that reopens this list rather than the generic draft.
        const url = new URL(window.location.href);
        if (url.searchParams.get("id") !== rowId) {
          url.searchParams.set("id", rowId);
          window.history.replaceState(null, "", url);
        }
        // Mark it opened so the effect above doesn't refetch and clobber
        // edits made after the save.
        openedId.current = rowId;
      }
      posthog.capture("tier_list_saved", {
        template: template.slug,
        ranked: rankedCount(next),
        created: !id,
      });
      return true;
    },
    [template.slug]
  );

  // "SAVED" was sticky: it was set on save and never cleared, so the
  // button went on claiming the list was saved through every edit that
  // followed. Any change to the board takes the confirmation back off.
  useEffect(() => {
    setSavedAt(0);
  }, [state]);

  // Resolves the account to save under, prompting for sign-in if needed.
  // Null means the caller should stop: either the prompt was dismissed,
  // or sign-in went out to Google and the page is about to reload, in
  // which case the effect below finishes the save on the way back.
  async function requireUserId(): Promise<string | null> {
    if (user?.id) return user.id;
    const signedIn = await requestSignIn();
    if (!signedIn) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.user.id ?? null;
  }

  // Save over the list currently open. Only offered when there IS one -
  // otherwise this is a create, and a create asks for a name first.
  async function handleSaveOver() {
    if (saving || !savedId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const userId = await requireUserId();
      if (!userId) return;
      await doSave(userId, state, savedId);
    } finally {
      setSaving(false);
    }
  }

  // Every create goes through the name dialog. Saving used to create a
  // new row whenever the editor happened not to be tracking one, which is
  // the case any time you arrive without ?id= - and since the working
  // draft survives navigation, that quietly cloned the last list you had
  // open under a new name, over and over.
  async function handleSaveAsNew() {
    if (saving) return;
    setSaveError(null);
    setNameError(null);
    // Sign in BEFORE the name dialog, not during it. Asking afterwards
    // put the sign-in prompt up while the name dialog was still on
    // screen, and it landed behind it.
    if (!user) {
      setSaving(true);
      try {
        if (!(await requireUserId())) return;
      } finally {
        setSaving(false);
      }
    }
    setNamingOpen(true);
  }

  // Two lists called the same thing are indistinguishable on the index,
  // which is the only place you pick between them. Checked here for a
  // useful message; the database enforces it as well, since this check
  // and the insert are not atomic.
  async function nameIsTaken(userId: string, name: string, exceptId: string | null) {
    try {
      const rows = await listMyTierLists(userId);
      const wanted = name.trim().toLowerCase();
      return rows.some(
        (r) => r.template === template.slug && r.id !== exceptId && r.title.trim().toLowerCase() === wanted,
      );
    } catch {
      // Don't block a save because the check itself failed - the unique
      // index still has the final say.
      return false;
    }
  }

  async function handleNameConfirm(name: string) {
    setSaving(true);
    setSaveError(null);
    setNameError(null);
    try {
      const userId = await requireUserId();
      if (!userId) {
        setNamingOpen(false);
        return;
      }
      if (await nameIsTaken(userId, name, null)) {
        setNameError("You already have a list with that name.");
        return;
      }
      // Renames the board too: this list is what you are editing now, so
      // the title above the board and the caption on its export follow.
      dispatch({ type: "setTitle", title: name });
      const ok = await doSave(userId, { ...state, title: name }, null);
      if (ok) setNamingOpen(false);
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
    doSave(user.id, state, savedId);
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
    // Shared under the name the board is showing, so renaming a list in
    // Edit Tiers changes the caption on the exported card too.
    const shared = { ...state, title: listTitleFor(state, template) };
    const blob = await renderTierShareImage({
      state: shared,
      template,
      authorLabel: profile?.display_name || profile?.username || null,
    });
    await shareBlob({
      blob,
      filename: `${template.slug}-tier-list.png`,
      title: template.title,
      text: `${shared.title}\n\n${buildReferralLink(profile?.username)}`,
      onShared: (method) => posthog.capture("tier_list_shared", { template: template.slug, method, ranked }),
    });
  }

  async function handleCreateLink() {
    const { code, error } = await createTierListShare({ ...state, title: listTitleFor(state, template) });
    if (error || !code) return null;
    const url = `${window.location.origin}/tier-lists/${template.slug}/share/${code}`;
    setShareUrl(url);
    posthog.capture("tier_list_link_created", { template: template.slug, ranked });
    return url;
  }

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, []);

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
      <main className="flex-1 px-4 pb-16 pt-10 max-w-[62.5rem] w-full mx-auto">
        <div className="flex justify-center pt-16">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      </main>
    );
  }

  // max-w-[62.5rem] is 1000px, and the chip solver above hardcodes that
  // same 1000 as its ceiling and as its ten-across breakpoint - all three
  // have to move together or the board stops holding exactly ten.
  return (
    <main className="flex-1 px-4 pb-16 pt-5 max-w-[62.5rem] w-full mx-auto">
      {/* Scrolls away - it's brand dressing, not something you need while
          you're working. The way back out rides on the same line, pinned
          left, so it costs no vertical room above the board: this page is
          already taller than the viewport and the title below is sticky.
          A real link, not history.back(), because you can arrive here
          straight from a share link or a bookmark with nothing to go back
          to. */}
      <div className="relative flex items-center justify-center mb-1.5">
        <Link
          href="/tier-lists"
          aria-label="All tier lists"
          className="absolute left-0 flex items-center gap-1 text-xs text-white/45 hover:text-white transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {/* The arrow alone carries it where the eyebrow would collide. */}
          <span className="hidden sm:inline tracking-[0.15em]">ALL TIER LISTS</span>
        </Link>
        <div className="text-center text-xs text-white/45 tracking-[0.25em]">SIDELINE BREW &middot; TIER LIST</div>
      </div>

      {/* Pinned directly above the board, and pinned literally: on a
          stream the board is taller than the viewport, so a title that
          scrolls away means the shot has no title on it for most of the
          session. Offset by the site header's own 72px. Everything that
          used to sit between the title and the board - progress, tier
          count, edit - is folded into one line here, which closed a
          101px gap down to about 30. */}
      {/* Nothing between the title and the board. Edit rides on the same
          line, pinned left, so the title sits directly on top of the
          thing it names. Still sticky, offset by the site header's 72px:
          the board is taller than the viewport, so without this the title
          leaves the frame the moment you scroll to the lower tiers - and
          on a stream that means most of the session is shot without one. */}
      <header className="sticky top-[72px] z-20 -mx-4 px-4 pt-1 pb-2 bg-[#0e1b33]">
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            aria-label={editing ? "Finish editing tiers" : "Edit tiers"}
            className={`absolute left-0 flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-2.5 sm:pr-3.5 text-[11px] border transition-colors ${
              editing
                ? "border-white/45 text-white bg-white/10"
                : "border-white/15 hover:border-white/35 text-white/60 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              {editing ? <path d="M20 6L9 17l-5-5" /> : <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></>}
            </svg>
            {/* Label drops on narrow screens so it can't collide with the
                centred title - the icon carries it on its own there. */}
            <span className="hidden sm:inline">{editing ? "DONE" : "EDIT TIERS"}</span>
          </button>

          {/* px-12 reserves the button's width on both sides so the
              centred title can never run into it on a narrow screen -
              they were landing flush at 375px.

              This is the LIST's name, not the category's. With several
              saved lists per category the name is what tells them apart,
              and it's what the exported image is captioned with, so the
              page has to show the same thing the share does. */}
          {editing ? (
            // A bare input with a hairline under it looked exactly like
            // the heading it replaced, so nobody could tell the name had
            // become editable at all. It gets the same treatment as a
            // field anywhere else in the app - a filled box, a border, a
            // pencil, and a caption saying what it is.
            <span className="w-full px-10 sm:px-12 flex flex-col items-center gap-1">
              <span className="flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
                LIST NAME
              </span>
              <input
                value={state.title}
                onChange={(e) => dispatch({ type: "setTitle", title: e.target.value })}
                // Caret at the end, not a select-all: this field is
                // centre-aligned, so a tap landed the caret in front of
                // the name and backspace appeared to do nothing.
                onFocus={(e) => {
                  const end = e.currentTarget.value.length;
                  e.currentTarget.setSelectionRange(end, end);
                }}
                maxLength={MAX_TITLE}
                aria-label="List title"
                placeholder={template.defaultListTitle}
                className="w-full text-center text-[clamp(1.1rem,4.6vw,2.1rem)] leading-tight tracking-wide rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 focus:border-white/60 focus:bg-white/15 outline-none uppercase placeholder:text-white/25 transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              />
            </span>
          ) : (
            <h1
              className="text-center text-[clamp(1.25rem,5.4vw,2.6rem)] leading-none tracking-wide px-12"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {listTitleFor(state, template).toUpperCase()}
            </h1>
          )}
        </div>

        {readOnlySnapshot && snapshotAuthor && (
          <p className="text-center text-white/45 text-xs mt-1.5">
            Originally ranked by <span className="text-white/70">{snapshotAuthor}</span>
          </p>
        )}
      </header>

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={(e: DragStartEvent) => {
          dragSession.current += 1;
          dragStartedAtTop.current = isInTier(state, String(e.active.id), topTierId);
          dragStartedAtBottom.current = isInTier(state, String(e.active.id), bottomTierId);
          setDraggingId(String(e.active.id));
          setSelectedId(null);
        }}
        onDragOver={handleDragOver}
        onDragCancel={() => {
          setDraggingId(null);
          setOverTier(undefined);
        }}
        onDragEnd={handleDragEnd}
      >
        {/* One solid block, not six cards. Rows sit flush against each
            other and this clips the outer corners, so the chevrons form a
            single continuous column and the board reads as one object.
            Opaque black also stops the page's tiled logo watermark showing
            through the rows. */}
        <div className="flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-black">
          {state.tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              index={i}
              itemIds={state.placements[tier.id] ?? []}
              template={template}
              chipSize={chipSize}
              railWidth={railWidth}
              first={i === 0}
              cascading={cascading}
              sweeping={sweeping}
              editing={editing}
              selectedItemId={selectedId}
              landedItemId={landedId}
              hot={overTier === tier.id}
              isDropTarget={!!selectedId}
              canMoveUp={i > 0}
              canMoveDown={i < state.tiers.length - 1}
              canDelete={state.tiers.length > 1}
              onRename={(label) => dispatch({ type: "renameTier", tierId: tier.id, label })}
              onCommitRename={() => setEditing(false)}
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
          hot={draggingId !== null && overTier === null}
          ids={state.unranked}
          template={template}
          chipSize={chipSize}
          selectedItemId={selectedId}
          landedItemId={landedId}
          onItemActivate={handleItemActivate}
          onPlaceSelected={() => placeSelected(null)}
          onShuffle={handleShuffle}
          scatterKey={scatterKey}
        />

        <DragOverlay dropAnimation={null}>
          {activeItem ? <TierItemChip item={activeItem} size={chipSize * 1.15} /> : null}
        </DragOverlay>
      </DndContext>

      {selectedId && (
        <p className="text-center text-xs text-white/50 mt-3">
          Now tap a tier to drop <span className="text-white/80">{resolveItem(template, selectedId).label}</span> in — or tap it again to cancel.
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

      {/* Saving over a list and creating one are separate buttons, because
          they are separate intentions and guessing between them is what
          quietly filled the index with copies of the same board. Which
          list is being written to is spelled out above them - a Save
          button whose target you can't see is the whole problem. */}
      <div className="flex flex-col items-center mt-3">
        <p className="text-xs text-white/45 mb-2 text-center px-4">
          {savedId ? (
            <>
              Editing <span className="text-white/75">{listTitleFor(state, template)}</span>
            </>
          ) : (
            "Not saved yet"
          )}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {savedId && (
            <button
              type="button"
              onClick={handleSaveOver}
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
                "SAVE CHANGES"
              )}
            </button>
          )}
          <button
            type="button"
            onClick={handleSaveAsNew}
            disabled={saving}
            className={
              savedId
                ? "flex items-center justify-center gap-2 h-9 rounded-full px-6 text-sm border border-white/20 hover:border-white/40 text-white/70 hover:text-white transition-colors disabled:opacity-60"
                : "flex items-center justify-center gap-2 h-9 rounded-full px-6 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-60"
            }
            style={
              savedId
                ? { fontFamily: "var(--font-display)" }
                : { fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #34d399, #059669)", color: "#ffffff" }
            }
          >
            {savedId ? "SAVE AS NEW LIST" : "SAVE MY TIER LIST"}
          </button>
        </div>
        {saveError && <p className="text-xs text-red-400 mt-2">{saveError}</p>}
      </div>


      <NameListDialog
        open={namingOpen}
        initialName={listTitleFor(state, template)}
        busy={saving}
        error={nameError}
        onCancel={() => {
          setNamingOpen(false);
          setNameError(null);
        }}
        onConfirm={handleNameConfirm}
      />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShareImage={handleShareImage}
        onCreateLink={handleCreateLink}
        shareUrl={shareUrl}
      />

      <TierCelebration
        key={celebration?.key}
        item={celebration?.item ?? null}
        variant={celebration?.variant}
        onDone={() => setCelebration(null)}
      />

      {dialog}
      {signInModal}
    </main>
  );
}

function UnrankedPool({
  hot,
  scatterKey,
  ids,
  template,
  chipSize,
  selectedItemId,
  landedItemId,
  onItemActivate,
  onPlaceSelected,
  onShuffle,
}: {
  hot: boolean;
  // Bumped on every shuffle so the chips can replay their scatter.
  scatterKey: number;
  ids: string[];
  template: TierTemplate;
  chipSize: number;
  selectedItemId: string | null;
  landedItemId: string | null;
  onItemActivate: (item: TierItem) => void;
  onPlaceSelected: () => void;
  onShuffle: () => void;
}) {
  // Registered so an empty pool is still a drop target; the lit state
  // comes from the page, which resolves item-hovers to their container.
  const { setNodeRef } = useDroppable({ id: "unranked" });
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
        className="rounded-2xl border p-2.5 flex flex-wrap gap-1.5 content-start transition-[background,border-color,box-shadow] duration-150"
        style={{
          minHeight: chipSize + 20,
          borderColor: hot ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.10)",
          // Same black as the board above it, so the pool reads as part
          // of the same surface. Lifts on drag-over exactly like a tier
          // row does, so dropping a team back out is the same gesture in
          // reverse.
          background: hot ? "#141414" : "#000000",
          boxShadow: hot ? "0 0 0 2px rgba(255,255,255,0.5), 0 10px 30px -12px rgba(0,0,0,0.9)" : undefined,
          cursor: selectedItemId ? "pointer" : undefined,
        }}
      >
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          {items.map((item, i) => (
            <SortableTierItem
              key={item.id}
              item={item}
              size={chipSize}
              selected={selectedItemId === item.id}
              landed={landedItemId === item.id}
              scatterKey={scatterKey}
              scatterIndex={i}
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
