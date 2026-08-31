"use client";

import { useState, useSyncExternalStore } from "react";

// The origin differs between localhost, a deploy preview and the live
// site, so the link is built from wherever this page is actually being
// served. window is an external store like any other - read through the
// API for external stores, so the server render and the client render
// agree instead of tripping hydration.
const NO_ORIGIN_LISTENERS = () => () => {};

// The handoff between the two screens: the one control that turns a game
// on a laptop into a graphic on a stream.
//
// It sits on the setup screen as well as the board, because OBS gets
// configured once, before anything is being played - having to start a
// draft in order to find the link would be backwards.

export function OverlayLink({
  code,
  live,
  viewers,
  onRotate,
}: {
  code: string | null;
  live: boolean;
  viewers: number;
  onRotate: () => void;
}) {
  const origin = useSyncExternalStore(
    NO_ORIGIN_LISTENERS,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);

  const url = code && origin ? `${origin}/versus/overlay?room=${code}&top=560&bottom=560` : "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard denied (no https, or a permission prompt refused). The
      // field below is selectable, so this is inconvenient, not fatal.
    }
  }

  return (
    <div className="rounded-2xl border p-4" style={{ background: "#101d38", borderColor: "rgba(255,255,255,0.12)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] tracking-[0.2em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
          OBS OVERLAY
        </span>
        {/* Honest about which of the two things is true: this page is on
            the channel, and something is listening on it. "Connected" on
            its own would be a lie whenever the URL is pasted in wrong. */}
        <span className="flex items-center gap-1.5 text-[11px] text-white/45">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: viewers > 0 ? "#00e35f" : live ? "#ffd23a" : "rgba(255,255,255,0.25)" }}
          />
          {viewers > 0 ? `${viewers} overlay${viewers === 1 ? "" : "s"} connected` : live ? "no overlay yet" : "offline"}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url || "—"}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-black/25 px-3 py-2 text-[12px] text-white/70 outline-none"
        />
        <button
          onClick={copy}
          disabled={!url}
          className="shrink-0 rounded-xl px-4 text-[12px] tracking-[0.12em] text-[#05070d] transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ fontFamily: "var(--font-display)", background: "#00e35f" }}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/40">
        Add a <strong className="font-normal text-white/60">Browser</strong> source in OBS, paste this in, set it to{" "}
        <strong className="font-normal text-white/60">1080 &times; 1920</strong>. Everything you do on this page shows up
        on it. Keep the link private &mdash; anyone who has it can drive the graphic.
      </p>

      <div className="mt-2 flex items-center gap-4">
        {url && (
          <a href={`${url}&preview=1`} target="_blank" rel="noreferrer" className="text-[11px] text-white/45 underline underline-offset-2 hover:text-white/70">
            Check it in a browser
          </a>
        )}
        <button onClick={onRotate} className="text-[11px] text-white/35 underline underline-offset-2 hover:text-white/60">
          New link
        </button>
      </div>
    </div>
  );
}
