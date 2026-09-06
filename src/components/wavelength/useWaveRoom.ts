"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { WavelengthState } from "@/lib/wavelength/engine";
import { redactFor } from "@/lib/wavelength/engine";
import { HELLO, STATE, isRoomCode, isWaveMessage, newRoomCode, waveChannel, type WaveMessage } from "@/lib/wavelength/room";

// The wavelength end of the same wire the draft uses, and built the same
// way for the same reasons - see src/components/versus/useRoom.ts. The one
// difference is the whole point of this game: what the overlay is allowed
// to be told. That lives in useWaveBroadcast, at the bottom.

// THE CODE HAS TO OUTLIVE THE PAGE. An OBS browser source is configured
// once and then left alone for months, so if a refresh of the board dealt
// a new code the overlay would quietly go dead and the only symptom would
// be a blank corner of the stream. It lives in localStorage, and changes
// only when the rotate button is pressed.
const ROOM_KEY = "sb.wavelength.room";

// localStorage is an external store, so it is read through the API React
// provides for external stores rather than through an effect: the server
// render (no code yet) and the client render (the code) then agree without
// a hydration mismatch and without a spinner.
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

export function useWaveRoomCode() {
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

// BOARD SIDE, AND THE ONE PLACE THE SECRET IS STRIPPED.
//
// redactFor() runs in here rather than at the call site, because "remember
// to redact before you send" is a rule somebody eventually forgets, and
// forgetting it once puts the answer in a payload that anybody holding the
// overlay URL can read. The page hands over the state it is playing; this
// hook is what decides the overlay does not get the target until there is
// no longer a target to protect.
//
// `state` is null before a game has been started. The board still joins
// the channel then, so the link can be pasted into OBS and confirmed
// working while there is still time to fix it.
export function useWaveBroadcast(code: string | null, deck: string, state: WavelengthState | null) {
  const latest = useRef<WaveMessage | null>(state ? { deck, state: redactFor(state) } : null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [live, setLive] = useState(false);
  const [viewers, setViewers] = useState(0);

  useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(waveChannel(code));
    channelRef.current = channel;

    // An overlay that just loaded has missed everything - OBS reloads a
    // browser source on every scene switch, and a broadcast channel has
    // no history. It says hello; the board answers.
    channel.on("broadcast", { event: HELLO }, () => {
      if (latest.current) void channel.send({ type: "broadcast", event: STATE, payload: latest.current });
    });
    // Only overlays track themselves, so the count is the count.
    channel.on("presence", { event: "sync" }, () => {
      setViewers(Object.keys(channel.presenceState()).length);
    });

    channel.subscribe((status) => {
      setLive(status === "SUBSCRIBED");
      // Covers the board joining second: push once on connect so an
      // overlay that has been waiting fills in without another move.
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
    latest.current = { deck, state: redactFor(state) };
    void channelRef.current?.send({ type: "broadcast", event: STATE, payload: latest.current });
  }, [deck, state]);

  return { live, viewers };
}

// OVERLAY SIDE. Listens, and holds on to the last thing it was told.
export function useWaveRoomState(code: string | null) {
  const [message, setMessage] = useState<WaveMessage | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!code) return;
    const channel = supabase.channel(waveChannel(code));

    channel.on("broadcast", { event: STATE }, ({ payload }) => {
      // Anything at all can arrive on a channel. A message that fails the
      // check is dropped rather than drawn, and the overlay keeps showing
      // the last good state - a crashed browser source is a black hole in
      // the middle of a live stream.
      if (isWaveMessage(payload)) setMessage(payload);
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
  // wobble mid-round should leave the graphic exactly where it was, not
  // blank the screen and then repopulate.
  return { message, live };
}
