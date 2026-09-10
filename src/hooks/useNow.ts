"use client";

import { useSyncExternalStore } from "react";

// A clock the render can read.
//
// Locking at kickoff only works if the page notices kickoff happening.
// Somebody who opens the board at 8:15 and is still looking at it at 8:21
// should watch that game go grey without touching anything - a lock that
// only applies on the next page load is a lock you can walk around by not
// reloading.
//
// One module-level interval shared by every subscriber, rather than one
// per component: the snapshot has to be referentially stable between
// ticks or useSyncExternalStore re-renders forever.

// 15s, so a game locks within 15 seconds of its kickoff minute. Kickoffs
// are on the minute and nothing here is worth a per-second render.
const TICK_MS = 15_000;

let cached = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function tick() {
  cached = Date.now();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    timer = setInterval(tick, TICK_MS);
    // Background tabs throttle timers hard - a phone left on the board
    // overnight can miss every tick. Coming back to the tab re-reads the
    // clock immediately, so what you see on wake is already current.
    window.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
      window.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    }
  };
}

const getSnapshot = () => cached;

// The server has no clock the client will agree with, and a mismatch here
// would flip cards between locked and open on first paint. 0 is "before
// every kickoff there has ever been", so the server renders the board
// open and hydration corrects it - the same way the page already treats
// the moment before weeks load.
const getServerSnapshot = () => 0;

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
