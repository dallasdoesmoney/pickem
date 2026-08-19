"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_TITLE } from "@/lib/tierList";

// Asked before a list is created, so a new save lands under a name the
// user chose rather than silently inheriting whatever the board happened
// to be called. Same shell as the app's other modals (scrim + max-w-sm
// #0b1730 panel).
export function NameListDialog({
  open,
  initialName,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  initialName: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reseed each time it opens - the board may have been renamed since.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
  }, [open, initialName]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const trimmed = name.trim();

  function submit() {
    if (!trimmed || busy) return;
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <h2 className="text-xl mb-1" style={{ fontFamily: "var(--font-display)" }}>
          NAME THIS LIST
        </h2>
        <p className="text-sm text-white/50 mb-4">Saved lists are told apart by their name.</p>

        <input
          ref={inputRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          onFocus={(e) => e.currentTarget.select()}
          maxLength={MAX_TITLE}
          aria-label="List name"
          // 16px so iOS doesn't zoom the page on focus.
          className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-base text-white placeholder:text-white/30 outline-none focus:border-white/40"
        />

        <div className="flex gap-2 mt-5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full px-5 py-2.5 text-sm border border-white/15 hover:border-white/35 text-white/70 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!trimmed || busy}
            className="flex-1 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              fontFamily: "var(--font-display)",
              background: "linear-gradient(135deg, #34d399, #059669)",
              color: "#ffffff",
            }}
          >
            {busy && <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
