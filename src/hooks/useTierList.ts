"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TierTemplate } from "@/data/tierTemplates";
import { TierListAction, TierListState, createInitialState, sanitizeState, tierListReducer } from "@/lib/tierList";

const MAX_HISTORY = 60;

function storageKey(slug: string) {
  return `pickem:tier-list:${slug}`;
}

// Typing a tier name one character at a time shouldn't cost one undo step
// per keystroke. Actions that return a key here coalesce with the
// immediately-preceding action carrying the same key.
function mergeKeyFor(action: TierListAction): string | null {
  if (action.type === "renameTier") return `rename:${action.tierId}`;
  if (action.type === "setTitle") return "title";
  // One drag = one undo step, however many hovers it passed through. The
  // token carries a per-drag session id, so dragging the same item twice
  // still produces two separate entries.
  if (action.type === "moveItem" && action.mergeToken) return `move:${action.mergeToken}`;
  return null;
}

// past/present/future move together or not at all - keeping them in one
// state object means an undo can never land half-applied, and there's a
// single setState per transition rather than three that React could
// interleave.
type History = { past: TierListState[]; present: TierListState; future: TierListState[] };

export type TierListHistory = {
  state: TierListState;
  // False until localStorage has been read, so the UI can hold off
  // rendering rather than flashing the default list over saved work.
  loaded: boolean;
  dispatch: (action: TierListAction) => void;
  // Replaces state AND clears history - for loading a saved list or a
  // shared snapshot, where undoing back into someone else's list would
  // be nonsense.
  replace: (next: TierListState) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function useTierList(template: TierTemplate): TierListHistory {
  // Deterministic first render on both server and client - saved state is
  // layered on in an effect below, never during render, so hydration
  // can't mismatch.
  const initial = useMemo(() => createInitialState(template), [template]);
  const [history, setHistory] = useState<History | null>(null);
  const lastMergeKey = useRef<string | null>(null);

  useEffect(() => {
    lastMergeKey.current = null;
    let restored: TierListState | null = null;
    try {
      const raw = localStorage.getItem(storageKey(template.slug));
      if (raw) restored = sanitizeState(JSON.parse(raw), template);
    } catch {
      // Corrupt or hand-edited local state falls back to a fresh list
      // rather than breaking the page.
    }
    setHistory({ past: [], present: restored ?? createInitialState(template), future: [] });
  }, [template]);

  const state = history?.present ?? initial;
  const loaded = history !== null;

  useEffect(() => {
    if (!history) return;
    try {
      localStorage.setItem(storageKey(template.slug), JSON.stringify(history.present));
    } catch {
      // Private mode / quota. Losing local persistence is survivable;
      // breaking every interaction that follows is not.
    }
  }, [history, template.slug]);

  const dispatch = useCallback((action: TierListAction) => {
    setHistory((h) => {
      if (!h) return h;
      const next = tierListReducer(h.present, action);
      // Reducer no-ops (dropping onto a deleted tier, hitting the tier
      // cap) shouldn't burn an undo slot.
      if (next === h.present) return h;

      const key = mergeKeyFor(action);
      const merging = key !== null && key === lastMergeKey.current;
      lastMergeKey.current = key;

      return {
        past: merging ? h.past : [...h.past, h.present].slice(-MAX_HISTORY),
        present: next,
        future: [],
      };
    });
  }, []);

  const replace = useCallback((next: TierListState) => {
    lastMergeKey.current = null;
    setHistory({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    lastMergeKey.current = null;
    setHistory((h) => {
      if (!h || !h.past.length) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastMergeKey.current = null;
    setHistory((h) => {
      if (!h || !h.future.length) return h;
      const [next, ...rest] = h.future;
      return {
        past: [...h.past, h.present].slice(-MAX_HISTORY),
        present: next,
        future: rest,
      };
    });
  }, []);

  return {
    state,
    loaded,
    dispatch,
    replace,
    undo,
    redo,
    canUndo: !!history?.past.length,
    canRedo: !!history?.future.length,
  };
}
