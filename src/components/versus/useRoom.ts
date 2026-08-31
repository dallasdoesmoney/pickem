"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { AuctionState } from "@/lib/auction/engine";
import { roomChannel, isBoardMessage, isRoomCode, newRoomCode, HELLO, STATE, type BoardMessage } from "@/lib/auction/room";

// THE CODE HAS TO OUTLIVE THE PAGE. An OBS browser source is configured
// once and then left alone for months, so if a refresh of the board dealt
// a new code the overlay would quietly go dead and the only symptom would
// be a blank corner of the stream. It lives in localStorage, and changes
// only when the rotate button is pressed.
const ROOM_KEY = "sb.versus.room";

// localStorage is an external store, so it is read through the API React
// provides for external stores rather than through an effect. That gets
// the server render (no code yet) and the client render (the code) to
// agree without a hydration mismatch, and without a spinner.
let cachedCode: string | null = null;
const codeListeners = new Set<() => void>();

function readCode(): string {
  // Cached so the snapshot is stable across renders - useSyncExternalStore
  // re-renders forever if this returns a fresh value each call.
  if (cachedCode) return cachedCode;
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(ROOM_KEY);
  } catch {
    // Private mode, or storage disabled. A code held only in memory still
    // works for one sitting, which beats no overlay at all.
  }
  if (!stored || !isRoomCode(stored)) {
    stored = newRoomCode();
    try {
      localStorage.setItem(ROOM_KEY, stored);
    } catch {}
  }
  cachedCode = stored;
  return cachedCode;
}

function subscribeCode(onChange: () => void) {
  codeListeners.add(onChange);
  return () => codeListeners.delete(onChange);
}

export function useRoomCode() {
  const code = useSyncExternalStore(subscribeCode, readCode, () => null);

  function rotate() {
    const next = newRoomCode();
    try {
      localStorage.setItem(ROOM_KEY, next);
    } catch {}
    cachedCode = next;
    codeListeners.forEach((fn) => fn());
  }

  return { code, rotate };
}

// The two ends of a room. The board talks, the overlay listens, and
// neither one ever writes to the database - see room.ts.

// BOARD SIDE. Pushes the whole state after every action, answers a new
// overlay's hello with the current state, and counts who is listening.
// `state` is null before a draft has been started. The board still joins
// the channel then, so the link can be pasted into OBS and confirmed
// working while there is still time to fix it; it just has nothing to
// say yet, and the overlay sits on WAITING FOR THE BOARD.
export function useBroadcast(code: string | null, slug: string, state: AuctionState | null) {
  const latest = useRef<BoardMessage | null>(state ? { slug, state } : null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(roomChannel(code));
    channelRef.current = channel;

    // An overlay just loaded and has no idea what is going on. Catch it up.
    channel.on("broadcast", { event: HELLO }, () => {
      if (latest.current) void channel.send({ type: "broadcast", event: STATE, payload: latest.current });
    });
    // Presence is how the board knows an overlay is actually there, as
    // opposed to the URL having been pasted into OBS wrong. Only overlays
    // track themselves, so the count is the count.
    channel.on("presence", { event: "sync" }, () => {
      setViewers(Object.keys(channel.presenceState()).length);
    });

    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
      // Covers the board joining second: push once on connect so an
      // overlay that has been waiting fills in without another action.
      if (status === "SUBSCRIBED" && latest.current) {
        void channel.send({ type: "broadcast", event: STATE, payload: latest.current });
      }
    });

    return () => {
      channelRef.current = null;
      setLive(false);
      setViewers(0);
      void supabase.removeChannel(channel);
    };
  }, [code]);

  useEffect(() => {
    if (!state) return;
    latest.current = { slug, state };
    void channelRef.current?.send({ type: "broadcast", event: STATE, payload: latest.current });
  }, [slug, state]);

  return { live, viewers };
}

// OVERLAY SIDE. Listens, and holds on to the last thing it was told.
export function useRoomState(code: string | null) {
  const [message, setMessage] = useState<BoardMessage | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(roomChannel(code));

    channel.on("broadcast", { event: STATE }, ({ payload }) => {
      // Dropped rather than drawn if it is malformed. The overlay keeps
      // showing the last good state instead of crashing to black.
      if (isBoardMessage(payload)) setMessage(payload);
    });

    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
      if (status !== "SUBSCRIBED") return;
      void channel.track({ role: "overlay" });
      void channel.send({ type: "broadcast", event: HELLO, payload: {} });
    });

    return () => {
      setLive(false);
      void supabase.removeChannel(channel);
    };
  }, [code]);

  // NOTE: `message` is never cleared on disconnect. A brief websocket
  // wobble mid-draft should leave the graphic exactly where it was, not
  // blank the screen and then repopulate.
  return { message, live };
}
