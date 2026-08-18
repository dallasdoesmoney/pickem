"use client";

import { useCallback, useState } from "react";

type ConfirmState = { message: string; confirmLabel: string; resolve: (ok: boolean) => void } | null;

// In-app replacement for window.confirm() - the native dialog reads as an
// "official" browser/OS chrome popup, not part of the product. Usage
// mirrors window.confirm's ergonomics: `if (await confirm("...")) doThing()`.
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmState>(null);

  const confirm = useCallback((message: string, confirmLabel: string = "CONFIRM") => {
    return new Promise<boolean>((resolve) => {
      setState({ message, confirmLabel, resolve });
    });
  }, []);

  function respond(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  const dialog = state && (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="alertdialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={() => respond(false)} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <p className="text-white text-base leading-relaxed">{state.message}</p>
        <div className="flex gap-3 justify-end mt-6">
          <button
            aria-label="Cancel"
            onClick={() => respond(false)}
            className="rounded-full px-5 py-2 text-xs text-white/60 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CANCEL
          </button>
          <button
            aria-label="Confirm"
            onClick={() => respond(true)}
            className="rounded-full px-5 py-2 text-xs text-white active:scale-95 transition-transform duration-150"
            style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #f87171, #dc2626)" }}
          >
            {state.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return { confirm, dialog };
}
