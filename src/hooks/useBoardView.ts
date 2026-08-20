"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { COMPACT_SCALE, PILL_WIDTH } from "@/components/GameCard";

// How the board is laid out and how big it is drawn - shared by the
// weekly picks page and the predictor's team pages, which had identical
// copies of the scale solver already.
//
// This exists because both boards are taller than a 720p capture: the
// weekly board alone is 734px before a single piece of chrome, so no
// amount of hiding things makes it fit. The two levers that actually
// work are spending horizontal room instead of vertical (more columns,
// same pill size) and scaling the whole thing down. Everything sized off
// the returned `scale` moves together, so titles and stat pills stay in
// proportion with the pills rather than drifting.

export type ColumnChoice = "auto" | 2 | 3 | 4;

export type BoardViewState = {
  columns: ColumnChoice;
  // User multiplier on top of the solved scale. Not the scale itself:
  // the solver still has to fit the columns across the screen, and this
  // rides on top of whatever it lands on.
  zoom: number;
  // Weekly only - the day/kickoff tabs above each pill.
  showTabs: boolean;
  // Weekly only - drops the spread/record line, which is a third of
  // every pill's height.
  compact: boolean;
  // Weekly only - your own record/rank readout above the board. On a
  // stream it is the host's account showing on someone else's screen,
  // and it is 58px.
  showRecordPill: boolean;
};

const DEFAULTS: BoardViewState = { columns: 2, zoom: 1, showTabs: true, compact: false, showRecordPill: true };
const STORAGE_KEY = "pickem:board-view";
export const ZOOM_MIN = 0.4;
export const ZOOM_MAX = 1.5;

// Room the board is allowed to take. The page's own px-4 on each side,
// and enough of a gutter that a maximised board isn't touching the
// window edge on a wide screen.
const PAGE_X = 16;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

function columnGap(viewportWidth: number): number {
  return viewportWidth < 640 ? 10 : 32;
}

// What one column of pills costs at full size, including its gap.
function columnsFit(viewportWidth: number, cols: number): boolean {
  const gap = columnGap(viewportWidth);
  const needed = cols * PILL_WIDTH * COMPACT_SCALE + gap * (cols - 1);
  return needed <= viewportWidth - PAGE_X * 2;
}

export function useBoardView() {
  const [state, setState] = useState<BoardViewState>(DEFAULTS);
  const [viewportWidth, setViewportWidth] = useState(390);
  const [viewportHeight, setViewportHeight] = useState(800);

  // Read after mount, never during render: the server has no local
  // storage, and seeding state from it directly tears on hydration.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* a corrupt or legacy value just means defaults */
    }
  }, []);

  useEffect(() => {
    function measure() {
      setViewportWidth(window.innerWidth);
      setViewportHeight(window.innerHeight);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const update = useCallback((patch: Partial<BoardViewState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode - the setting just doesn't persist */
      }
      return next;
    });
  }, []);

  // "auto" takes the most columns that still fit at full pill size, so
  // it never trades legibility for width. Everything else is honoured
  // as asked, and the scale solver deals with the consequences.
  const cols = useMemo(() => {
    if (state.columns !== "auto") {
      // Not on a phone, though - three columns of anything on a 390px
      // screen is unreadable no matter what the setting says.
      return viewportWidth < 640 ? 2 : state.columns;
    }
    for (const candidate of [4, 3] as const) {
      if (columnsFit(viewportWidth, candidate)) return candidate;
    }
    return 2;
  }, [state.columns, viewportWidth]);

  const gap = columnGap(viewportWidth);

  // Width the grid is allowed: never more than the columns can actually
  // use at full size, so extra screen becomes margin rather than dead
  // space inside the grid.
  const contentWidth = useMemo(() => {
    const available = viewportWidth - PAGE_X * 2;
    const maxUseful = cols * PILL_WIDTH * COMPACT_SCALE + gap * (cols - 1);
    return Math.min(available, maxUseful);
  }, [viewportWidth, cols, gap]);

  const baseScale = useMemo(() => {
    const columnWidth = (contentWidth - gap * (cols - 1)) / cols;
    return Math.min(COMPACT_SCALE, Math.max(0.3, columnWidth / PILL_WIDTH));
  }, [contentWidth, gap, cols]);

  const scale = baseScale * state.zoom;

  // --- fit to screen -------------------------------------------------
  //
  // Solved by measuring the whole page against the viewport, not by
  // modelling it. The first version measured just the board and
  // subtracted a guess at what sat underneath it; the guess was wrong on
  // the predictor, which carries more below the board than the weekly
  // page does, and fit stopped 121px too tall. The page's own height
  // needs no guessing and is right on both.
  //
  // It still takes several passes, because height is not proportional to
  // zoom: the site header and the back rail are a fixed 106px that never
  // scale, several controls have pixel floors so they stay tappable, and
  // text wraps at thresholds. Each pass corrects by whatever ratio the
  // last one was off by, which converges quickly. The tolerance stops it
  // oscillating around a wrap point forever.
  const [fitPasses, setFitPasses] = useState(0);
  const fitToScreen = useCallback(() => setFitPasses(10), []);

  useLayoutEffect(() => {
    if (fitPasses <= 0) return;
    const total = document.documentElement.scrollHeight;
    const available = window.innerHeight;
    if (total <= 0) {
      setFitPasses(0);
      return;
    }
    const ratio = available / total;
    // Only ever shrink past a fit, never grow past one: 1.5% under is
    // finished, and creeping up to fill the last pixel just risks
    // overshooting on the next wrap.
    if (ratio >= 1 && ratio < 1.01) {
      setFitPasses(0);
      return;
    }
    const next = clampZoom(state.zoom * ratio);
    // Bail only when the clamp is actually binding - another pass would
    // re-clamp to the same number forever. This used to bail on any
    // small step, which stopped the solve four pixels short every time:
    // the final correction is by construction a small one.
    if (next === state.zoom) {
      setFitPasses(0);
      return;
    }
    setFitPasses((n) => n - 1);
    update({ zoom: next });
  }, [fitPasses, state.zoom, update]);

  return {
    ...state,
    setColumns: (columns: ColumnChoice) => update({ columns }),
    setZoom: (zoom: number) => update({ zoom: clampZoom(zoom) }),
    setShowTabs: (showTabs: boolean) => update({ showTabs }),
    setCompact: (compact: boolean) => update({ compact }),
    setShowRecordPill: (showRecordPill: boolean) => update({ showRecordPill }),
    reset: () => update(DEFAULTS),
    fitToScreen,
    fitting: fitPasses > 0,
    // Derived, for the pages to lay out with.
    cols,
    gap,
    contentWidth,
    scale,
    viewportWidth,
    viewportHeight,
    // True where a phone is overriding the column choice, so the control
    // can say so instead of looking broken.
    columnsLockedByWidth: viewportWidth < 640 && state.columns !== 2,
  };
}

export type BoardView = ReturnType<typeof useBoardView>;
