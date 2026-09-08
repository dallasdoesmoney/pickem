"use client";

import { useState, useSyncExternalStore } from "react";

// THE OTHER LINK. The OBS one is for a browser source that only watches;
// this one is for a person, and it is the only thing on the channel that
// can push back.
//
// Deliberately its own panel rather than a second field under the overlay
// link, because it does a different thing and carries a different warning:
// anybody who opens it can move the needle.

const NO_ORIGIN_LISTENERS = () => () => {};

export function JoinLink({ code }: { code: string | null }) {
  const origin = useSyncExternalStore(
    NO_ORIGIN_LISTENERS,
    () => window.location.origin,
    () => "",
  );
  const [copied, setCopied] = useState(false);
  const url = code && origin ? `${origin}/wavelength/join?room=${code}` : "";

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard denied (no https, or a prompt refused). The field is
      // selectable, so this is inconvenient rather than fatal.
    }
  }

  return (
    <div className="border-t pt-4" style={{ borderColor: "rgba(255,255,255,0.10)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] tracking-[0.2em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
          SOMEBODY ELSE ON THE DIAL
        </span>
        <span className="text-[11px] text-white/35">{code ?? "—"}</span>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          readOnly
          value={url || "—"}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-xl bg-black/25 px-3 py-2.5 text-[12px] text-white/60 outline-none"
          style={{ border: "2px solid rgba(255,255,255,0.10)" }}
        />
        <button
          onClick={copy}
          disabled={!url}
          className="shrink-0 rounded-xl px-5 text-[12px] tracking-[0.14em] text-[#05070d] transition-transform active:scale-[0.98] disabled:opacity-40"
          style={{ fontFamily: "var(--font-display)", background: "#3aa8ff" }}
        >
          {copied ? "COPIED" : "COPY"}
        </button>
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-white/40">
        Whoever opens this turns the needle from their own phone; you still deal, reveal and
        score from here. They see everything the stream sees &mdash;{" "}
        <strong className="font-normal text-white/60">including the target while you hold the dial open</strong>,
        so this is a link for the people playing, not for the person guessing against you.
      </p>
    </div>
  );
}
