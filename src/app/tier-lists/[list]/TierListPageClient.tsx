"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import {
  createTierListShare,
  fetchTierList,
  listMyTierLists,
  recordTierListBuild,
  recordTierListView,
  saveTierList,
} from "@/lib/supabase/tierLists";
import { renderTierShareImage } from "@/lib/tierShareImage";
import { shareBlob } from "@/lib/shareBlob";
import { buildReferralLink } from "@/lib/referralStorage";
import { TierItemChip, SortableTierItem } from "@/components/tierList/TierItemChip";
import { TierRow } from "@/components/tierList/TierRow";
import { PyramidView, POOL_ID as PYRAMID_POOL } from "@/components/tierList/PyramidView";
import {
  CAPS,
  RANKED,
  ROW_OF,
  fillSlots,
  insertionForRank,
  pyramidBands,
  readingOrder,
  solvePyramid,
} from "@/components/tierList/pyramid";
import { readBoard, runCascade } from "@/components/tierList/cascade";
import { tierLabelSizes } from "@/components/tierList/tierLabel";
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
  // Which layout the board is in. "rows" is the tier list and is the only
  // one that edits it; see the pyramid block below.
  const [view, setView] = useState<"rows" | "pyramid">("rows");
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

  // Count the open. Not gated on being signed in - the board is usable
  // signed out, and a count that skipped those people would undercount
  // the categories strangers arrive on most.
  //
  // A share link counts from "Make Your Own", not from landing on it: the
  // read-only preview is its own page and never mounts this editor. That
  // is the right line anyway - looking at one person's finished list is
  // not the same as opening the category.
  useEffect(() => {
    recordTierListView(template.slug);
  }, [template.slug]);

  // Count the first real change, signed in or not - saves alone miss
  // everyone who ranks a board, screenshots it and leaves, which on a
  // page that works fine signed out is most people.
  //
  // canUndo is exactly the right signal and needs no new bookkeeping: the
  // history only grows on a dispatch the reducer actually acted on, so
  // hovers, no-op drops and the tier cap don't count. Crucially replace()
  // clears it, so seeding from a share link or opening a saved list -
  // both of which land a fully ranked board on screen without anyone
  // touching it - does not read as an edit. Latched by the storage guard
  // in recordTierListBuild, so undoing back to an empty history doesn't
  // arm it a second time.
  useEffect(() => {
    if (canUndo) recordTierListBuild(template.slug);
  }, [canUndo, template.slug]);

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
  // What this list is CALLED in your saved lists. Separate from
  // state.title, which is the heading on the board and on the share card:
  // naming a save used to overwrite that heading.
  const [savedName, setSavedName] = useState<string | null>(null);
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
        setSavedName(row.title);
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
    // 1056 is the board's max width (max-w-[66rem] on the main below) and
    // is chosen, not rounded to: at an 80px chip and the rail below it
    // leaves a track that holds exactly ten marks with ~16px to spare. It
    // has to move in step with BOTH the chip cap and the rail - all three
    // come out of the same width - so widening the mark without widening
    // this is what costs a column.
    const content = Math.min(viewportWidth, 1056) - 32;
    // The rail carries names now, not just letters, so it's held wide
    // enough for a phrase like "SUPER BOWL CONTENDER" to wrap across two
    // or three readable lines. A phone still can't spare as much as a
    // desktop can, so it gets a narrower one and wraps sooner.
    //
    // 104 rather than 86 on a phone, which is what buys the name size its
    // floor: a twelve-letter word has to fit the rail on ONE line, and at
    // 86 the only size that managed it was 8px. Measured cost at 390: the
    // mark goes 46px to 42, and the same five still fit a line. At 320 it
    // is already at its 34px floor, so nothing changes there but the
    // track.
    const base = viewportWidth < 768 ? 104 : 136;
    const track = content - base - 16;
    // Ten across from 1024 up - any normal laptop - rather than only once
    // the board hits its own max width. Between the two the chip solves a
    // little under its cap to make room, which is the right trade at that
    // size: ten marks at 78px beats nine at 80. Below 1024 the tenth
    // column would come out of the mark instead, so it waits.
    const perRow =
      viewportWidth < 400 ? 5 : viewportWidth < 768 ? 7 : viewportWidth < 1024 ? 8 : 10;
    const size = Math.floor((track - (perRow - 1) * 6) / perRow);
    // Desktop earns a bigger mark than the old 58px cap allowed - this
    // page IS the logos, so they should be what you actually look at.
    // Don't raise this without re-measuring: the rail width below is
    // derived from the chip, so a bigger chip widens the rail, which eats
    // the very track the chips need and can cost a whole column. At 80 the
    // rail formula still lands under its 136 floor, so the floor holds.
    const chip = Math.max(34, Math.min(80, size));
    // The chevron has to read as a landscape tab, not a square - a name
    // like "SHOULD BE FIRED" needs horizontal room, and a rail narrower
    // than the row is tall looks like a stub. Held wider than the row
    // height whatever the chip size works out to be.
    const rail = Math.max(base, Math.round((chip + 16) * 1.28));
    return { chipSize: chip, railWidth: rail };
  }, [viewportWidth]);

  // ------------------------------------------------------- pyramid mode
  //
  // The same board, laid out as sixteen places in four rows instead of as
  // tiers. It is a VIEW: it holds no state of its own and every move made
  // in it is made on the board, so switching back shows the arrangement
  // you just built rather than the one you started with. Slot n is
  // reading position n, and insertionForRank turns that back into a tier
  // and a place in it.
  const pyrShape = useMemo(() => solvePyramid(Math.min(viewportWidth, 1056) - 32), [viewportWidth]);
  // Which container a pyramid drag is over: a slot index, "pool", or null.
  const [pyrOver, setPyrOver] = useState<number | "pool" | null>(null);

  const order = useMemo(() => readingOrder(state), [state]);
  const pyrSlots = useMemo(() => fillSlots(order), [order]);
  const bands = useMemo(() => pyramidBands(state.tiers), [state.tiers]);
  // Below the cut, in the order the board has them: the ranked ones that
  // did not make the top sixteen first, then everything unranked.
  const missedTheCut = useMemo(
    () => [...order.slice(RANKED), ...state.unranked],
    [order, state.unranked]
  );

  const placeInSlot = useCallback(
    (itemId: string, slot: number) => {
      const { tier, index } = insertionForRank(state, itemId, slot, ROW_OF[slot]);
      dispatch({ type: "moveItem", itemId, toTier: tier, toIndex: index });
    },
    [state, dispatch]
  );

  // Out of the pyramid is not out of the list: the cut already holds
  // ranked teams that placed seventeenth and lower, so this drops the
  // team to exactly there rather than unranking it. Unranking is what the
  // tier list's own pool is for.
  const dropFromPyramid = useCallback(
    (itemId: string) => {
      const { tier, index } = insertionForRank(state, itemId, RANKED, CAPS.length - 1);
      dispatch({ type: "moveItem", itemId, toTier: tier, toIndex: index });
    },
    [state, dispatch]
  );

  // ------------------------------------------------------- the cascade
  //
  // Both directions are driven from here rather than from either layout,
  // because only here are both ends measurable in the same frame. See
  // cascade.ts for what actually moves.
  const boardRef = useRef<HTMLDivElement>(null);
  const switchView = useCallback(
    (next: "rows" | "pyramid") => {
      setSelectedId(null);
      const board = boardRef.current;
      const reduced =
        typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced || !board) {
        setView(next);
        return;
      }
      const before = readBoard(board, next === "pyramid" ? "rows" : "pyramid", pyrShape);
      // Synchronous so the new layout can be measured in the same frame -
      // a normal setState would paint the destination first and there
      // would be nothing left to animate from.
      flushSync(() => setView(next));
      runCascade(board, next, pyrShape, before);
    },
    [pyrShape],
  );

  // Two sizes for the whole board - one for letters, one shared by every
  // name. Solved here because no single row can know what the others are
  // called.
  const labelSizes = useMemo(
    () =>
      tierLabelSizes(
        state.tiers.map((t, i) => tierLabelFor(t, i)),
        railWidth - 12,
        // The shortest a row can be. A tier holding two rows of marks is
        // taller, but the name must not have to grow into that to fit.
        chipSize + 16
      ),
    [state.tiers, railWidth, chipSize]
  );

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

  // Drops in the pyramid land on a slot, on the cut, or on another mark -
  // and a mark inherits whatever it is sitting in, exactly as a tier drop
  // does, so aiming at a team works as well as aiming at its square.
  function pyramidTarget(overId: string): number | "pool" | null {
    if (overId === PYRAMID_POOL) return "pool";
    if (overId.startsWith("pyr:")) return Number(overId.slice(4));
    const slot = pyrSlots.indexOf(overId);
    if (slot >= 0) return slot;
    return missedTheCut.includes(overId) ? "pool" : null;
  }

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
    if (view === "pyramid") {
      // Nothing moves until the drop. A pyramid row cannot grow to make
      // room, so shuffling its marks live would just thrash sixteen fixed
      // places while the cursor wandered.
      setPyrOver(pyramidTarget(overId));
      return;
    }
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
    setPyrOver(null);
    if (!over) return;
    const id = String(active.id);
    if (view === "pyramid") {
      const target = pyramidTarget(String(over.id));
      if (target === "pool") dropFromPyramid(id);
      else if (target !== null) placeInSlot(id, target);
      setSelectedId(null);
      return;
    }
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

  // Emptying the board and undoing your tier setup are different regrets,
  // and one button for both meant you couldn't have either on its own.
  async function handleClearBoard() {
    const noun = template.itemNoun[1];
    if (!(await confirm(`Send all ${noun} back to Unranked? Your tiers stay as they are.`, "CLEAR BOARD"))) return;
    // Sweep first, clear second. Clearing instantly gave no sense that
    // anything happened - the board just blinked and everything was gone.
    setSweeping(true);
    setTimeout(() => {
      dispatch({ type: "clearBoard", template });
      setSweeping(false);
    }, 420);
    posthog.capture("tier_list_cleared", { template: template.slug });
  }

  async function handleResetTiers() {
    const extra = Math.max(0, state.tiers.length - 6);
    const warning = extra
      ? ` The ${template.itemNoun[1]} in your ${extra} extra ${extra === 1 ? "tier" : "tiers"} go back to Unranked.`
      : "";
    const renamed = listTitleFor(state, template) !== template.defaultListTitle;
    const titleNote = renamed ? " The heading goes back to its default too." : "";
    if (
      !(await confirm(
        `Put the tiers back to S through F? Your ranking is kept.${titleNote}${warning}`,
        "RESET TIERS",
      ))
    )
      return;
    dispatch({ type: "resetTiers", template });
    posthog.capture("tier_list_tiers_reset", { template: template.slug });
  }

  // Shuffle reorders instantly, which reads as nothing happening at all.
  // Bumping the key replays a scatter across the pool as the new order
  // lands underneath it.
  function handleShuffle() {
    dispatch({ type: "shuffleUnranked" });
    setScatterKey((k) => k + 1);
  }

  const doSave = useCallback(
    async (userId: string, draft: TierListState, id: string | null, listName: string) => {
      // Board title normalised so the heading and the exported card never
      // go blank; the list's own name is passed through untouched.
      const next = { ...draft, title: listTitleFor(draft, template) };
      const { id: rowId, error } = await saveTierList(userId, next, id, listName);
      if (error) {
        setSaveError(error);
        return false;
      }
      setSaveError(null);
      setSavedAt(Date.now());
      if (rowId) {
        setSavedId(rowId);
        setSavedName(listName);
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
      await doSave(userId, state, savedId, savedName ?? listTitleFor(state, template));
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
      // Names the SAVE, not the board. The heading you set stays put, and
      // is only ever the starting suggestion for this field.
      const ok = await doSave(userId, state, null, name);
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
    doSave(user.id, state, savedId, savedName ?? listTitleFor(state, template));
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
    // Whatever is on screen is what gets shared. A card that came back
    // as tiers after you had built a pyramid read as the button being
    // broken.
    const blob = await renderTierShareImage({
      state: shared,
      template,
      pyramid: view === "pyramid" ? pyrSlots : null,
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
      <main className="flex-1 px-4 pb-16 pt-10 max-w-[66rem] w-full mx-auto">
        <div className="flex justify-center pt-16">
          <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      </main>
    );
  }

  // max-w-[66rem] is 1000px, and the chip solver above hardcodes that
  // same 1000 as its ceiling and as its ten-across breakpoint - all three
  // have to move together or the board stops holding exactly ten.
  return (
    <main className="flex-1 px-4 pb-16 max-w-[66rem] w-full mx-auto">
      {/* The rail that used to live here - the way back to all tier
          lists - is in NavShell now, on every page. It started here
          because this page's exit was the worst, and it turned out every
          page had the same problem in a milder form. */}
      {/* Pinned directly above the board, and pinned literally: on a
          stream the board is taller than the viewport, so a title that
          scrolls away means the shot has no title on it for most of the
          session. Offset by the site header's own 72px. Everything that
          used to sit between the title and the board - progress, tier
          count, edit - is folded into one line here, which closed a
          101px gap down to about 30. */}
      {/* Nothing between the title and the board. Edit rides on the same
          line, pinned left, so the title sits directly on top of the
          thing it names. Still sticky, and now offset by the site
          header's 72px plus the wayfinding rail's 34 - the two stack, so
          the title has to come to rest under both rather than sliding
          beneath the rail. The board is taller than the viewport, so
          without this the title leaves the frame the moment you scroll to
          the lower tiers - and on a stream that means most of the session
          is shot without one. */}
      <header className="sticky top-[106px] z-20 -mx-4 px-4 pt-1 pb-2 bg-[#070e1c]">
        <div className={editing ? "flex items-center gap-3" : "relative flex items-center justify-center"}>
          <button
            type="button"
            onClick={() => {
              setView("rows");
              setEditing((v) => !v);
            }}
            aria-pressed={editing}
            aria-label={editing ? "Finish editing tiers" : "Edit tiers"}
            className={`${editing ? "shrink-0" : "absolute left-0"} flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-2.5 sm:pr-3.5 text-[11px] border transition-colors ${
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
            <span className="min-w-0 flex-1 flex flex-col items-center gap-1">
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

        {/* Hidden while editing tiers: adding, renaming and reordering
            tiers are all about a list of rows, and the pyramid has four
            fixed bands instead. Switching in is what would need explaining,
            not the toggle being absent. */}
        {!editing && (
          <div className="flex justify-center mt-2">
            <div className="flex gap-1 rounded-full border border-white/12 bg-black/40 p-1">
              {(["rows", "pyramid"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => {
                    if (v !== view) switchView(v);
                  }}
                  className={`rounded-full px-5 py-1.5 text-[11px] transition-colors ${
                    view === v ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {v === "rows" ? "TIER LIST" : "PYRAMID"}
                </button>
              ))}
            </div>
          </div>
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
        <div ref={boardRef}>
        {/* One solid block, not six cards. Rows sit flush against each
            other and this clips the outer corners, so the colour column
            runs unbroken and the board reads as one object. Opaque black
            also stops the page's tiled logo watermark showing through the
            rows. */}
        <div
          className="flex flex-col rounded-2xl border border-white/10 overflow-hidden bg-black"
          style={{ display: view === "pyramid" ? "none" : undefined }}
        >
          {view === "rows" && state.tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              index={i}
              itemIds={state.placements[tier.id] ?? []}
              template={template}
              chipSize={chipSize}
              railWidth={railWidth}
              labelSizes={labelSizes}
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

        {view === "rows" ? (
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
        ) : (
          <PyramidView
            template={template}
            shape={pyrShape}
            bands={bands}
            slots={pyrSlots}
            missed={missedTheCut}
            selectedId={selectedId}
            landedId={landedId}
            poolHot={pyrOver === "pool"}
            onItemActivate={handleItemActivate}
            onPlaceSlot={(slot) => {
              if (!selectedId) return;
              placeInSlot(selectedId, slot);
              flashLanded(selectedId);
              setSelectedId(null);
            }}
            onPlacePool={() => {
              if (!selectedId) return;
              dropFromPyramid(selectedId);
              setSelectedId(null);
            }}
          />
        )}

        </div>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <TierItemChip
              item={activeItem}
              style={template.itemStyle}
              size={(view === "pyramid" ? pyrShape.chip : chipSize) * 1.15}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedId && (
        <p className="text-center text-xs text-white/50 mt-3">
          Now tap {view === "pyramid" ? "a place" : "a tier"} to drop{" "}
          <span className="text-white/80">{resolveItem(template, selectedId).label}</span> in — or tap it again to cancel.
        </p>
      )}

      {/* Controls. Deliberately below the list and visually quiet - they
          support the ranking, they aren't the point of the page. */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
        <GhostButton onClick={handleClearBoard} label="Clear the board">
          CLEAR BOARD
        </GhostButton>
        <GhostButton onClick={handleResetTiers} label="Reset tiers to default">
          RESET TIERS
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
              Editing <span className="text-white/75">{savedName ?? listTitleFor(state, template)}</span>
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
              style={template.itemStyle}
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
