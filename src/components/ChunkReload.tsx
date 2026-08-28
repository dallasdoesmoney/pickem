"use client";

import { useEffect } from "react";
import posthog from "posthog-js";

// Recovers from the error page a deploy leaves behind.
//
// Next gives every JS chunk a content hash in its filename. When a new
// build goes live those filenames change and the old ones stop existing,
// so a browser still holding the pre-deploy HTML asks for a chunk that is
// now a 404, and Next renders its built-in "This page couldn't load".
// Nothing is wrong with the app or the person's connection - they were
// simply mid-session when we shipped, and the fix is to fetch the page
// again.
//
// So this does that for them: one reload, which is the difference between
// a dead end and a blink.

// At most one reload per window. A build that is genuinely broken would
// otherwise put somebody in a loop that never ends and never explains
// itself - far worse than the error page it is trying to avoid. After
// this many milliseconds the door opens again, so a second deploy an hour
// later can still be recovered from.
const COOLDOWN_MS = 30_000;
const KEY = "sb:chunk-reload-at";

// Every phrasing browsers use for "the JavaScript did not arrive".
// Chrome and Firefox raise ChunkLoadError by name; Safari and the dynamic
// import path only give a message.
const CHUNK_MESSAGE =
  /chunkloaderror|loading chunk \S+ failed|failed to load chunk|error loading dynamically imported module|importing a module script failed|failed to fetch dynamically imported module/i;

function isChunkFailure(err: unknown): boolean {
  if (!err) return false;
  const name = (err as { name?: string }).name ?? "";
  const message = (err as { message?: string }).message ?? String(err);
  return name === "ChunkLoadError" || CHUNK_MESSAGE.test(`${name} ${message}`);
}

export function ChunkReload() {
  useEffect(() => {
    function recover(why: string) {
      let last = 0;
      try {
        last = Number(sessionStorage.getItem(KEY) ?? 0);
      } catch {
        // Private mode, or storage blocked. Without somewhere to record
        // the attempt there is no way to stop a loop, so do nothing and
        // leave the person with the error page and its Reload button.
        return;
      }
      if (Date.now() - last < COOLDOWN_MS) return;

      try {
        sessionStorage.setItem(KEY, String(Date.now()));
      } catch {
        return;
      }

      // Sent before the reload rather than after, because after does not
      // exist - and this is the only way to know how often a deploy is
      // interrupting somebody. send_instant so it is not still sitting in
      // a queue when the page goes away.
      try {
        posthog.capture("chunk_load_recovered", { why, path: window.location.pathname }, { send_instantly: true });
      } catch {
        // Telemetry must never be the reason somebody stays stuck.
      }

      window.location.reload();
    }

    // The dynamic-import path. A failed route chunk surfaces here rather
    // than as an uncaught error, which is why listening for "error" alone
    // would miss the most common case.
    const onRejection = (e: PromiseRejectionEvent) => {
      if (isChunkFailure(e.reason)) recover("unhandledrejection");
    };

    const onError = (e: ErrorEvent | Event) => {
      // Two very different events share this name. A resource that failed
      // to load fires a non-bubbling event whose target is the element;
      // an uncaught exception fires an ErrorEvent with .error set.
      const target = e.target as HTMLElement | null;
      if (target && target !== (window as unknown as HTMLElement)) {
        const src =
          (target as HTMLScriptElement).src ?? (target as HTMLLinkElement).href ?? "";
        // STRICTLY our own build output, and only script or stylesheet.
        // This listener sees every failed image on the page, and the
        // player headshots come from a third party that is down often
        // enough to matter - reloading the page because a face did not
        // arrive would be a far worse bug than the one being fixed here.
        const tag = target.tagName;
        if ((tag === "SCRIPT" || tag === "LINK") && typeof src === "string" && src.includes("/_next/static/")) {
          recover(`resource:${tag.toLowerCase()}`);
        }
        return;
      }
      if (isChunkFailure((e as ErrorEvent).error ?? (e as ErrorEvent).message)) recover("error");
    };

    // Capture phase for the resource case: those events do not bubble, so
    // a listener on window only sees them on the way down.
    window.addEventListener("error", onError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
