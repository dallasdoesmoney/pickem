"use client";

// The "you're halfway through, want to keep this?" pitch.
//
// Lifted out of the weekly page so the predictor can show the same one.
// It had no prompt at all, which meant somebody could fill in a whole
// eighteen-week season signed out and never be told the work was sitting
// in one browser - and the two boards should not be making different
// promises about the same account.
//
// Same chrome and the same three-tile grid as the sign-in modal's own
// referral pitch (useSignInModal.tsx). This is the same sell, triggered
// by progress instead of by a referral link.
//
// It says nothing about WHAT was picked, which is why one component can
// serve both boards: `context` carries the only line that differs.
export function SavePicksPrompt({
  context,
  onSignUp,
  onDismiss,
}: {
  // The half-sentence after the em dash - "Week 3", "the Ravens' season".
  context: string;
  onSignUp: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onDismiss} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <button
          type="button"
          aria-label="Close"
          onClick={onDismiss}
          className="absolute top-4 right-4 h-7 w-7 rounded-full border border-white/15 text-white/50 hover:text-white flex items-center justify-center transition-colors"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
        </button>

        <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
          WANT TO SAVE THESE PICKS?
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-4">
          You&rsquo;re halfway through {context} &mdash; sign up free to lock them in.
        </p>

        <div className="flex flex-col items-center gap-1.5 text-center mb-4">
          <span
            className="h-12 w-12 rounded-full flex items-center justify-center text-xl"
            style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
          >
            🏈
          </span>
          <span className="text-xs text-white/70">Create a free profile to keep them</span>

          <div className="grid grid-cols-3 gap-2 w-full mt-2.5">
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
              <span className="text-base leading-none">💾</span>
              <span className="text-[10px] font-semibold mt-0.5">SAVE PICKS</span>
              <span className="text-[8.5px] text-white/40">Any device</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
              <span className="text-base leading-none">🏆</span>
              <span className="text-[10px] font-semibold mt-0.5">TRACK RECORD</span>
              <span className="text-[8.5px] text-white/40">Every week</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-1.5 py-2.5">
              <span className="text-base leading-none">👥</span>
              <span className="text-[10px] font-semibold mt-0.5">COMPARE</span>
              <span className="text-[8.5px] text-white/40">With friends</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignUp}
          className="w-full rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
        >
          SIGN UP FREE
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full text-center text-xs text-white/45 hover:text-white/70 mt-3 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
