"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onShareImage: () => Promise<void>;
  onCreateLink: () => Promise<string | null>;
  shareUrl: string | null;
};

// Same shell as every other modal in the app (overlay + bg-black/60 scrim
// + max-w-sm #0b1730 panel) so this doesn't read as a bolted-on surface.
export function ShareDialog({ open, onClose, onShareImage, onCreateLink, shareUrl }: Props) {
  const [busy, setBusy] = useState<"image" | "link" | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleImage() {
    setBusy("image");
    setError(null);
    try {
      await onShareImage();
      // Once this resolves the image has already been handed off - to the
      // OS share sheet on touch, or straight to a download everywhere
      // else - so the dialog has nothing left to say and dismissing it by
      // hand is just an extra tap. The picks page shares directly from
      // its button with no modal at all; this is the closest equivalent.
      // Only on success: a failure has to stay up to show the error.
      onClose();
    } catch {
      setError("Couldn't build the image. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleLink() {
    setBusy("link");
    setError(null);
    try {
      const url = await onCreateLink();
      if (!url) {
        setError("Couldn't create a share link. Try again.");
        return;
      }
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        // Matches the app's existing 2-second inline confirmation idiom
        // (EditProfileModal's "Saved", MyReferralsModal's "COPIED").
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard can be blocked; the URL is still shown below to copy
        // by hand, so this isn't an error worth surfacing.
      }
    } catch {
      setError("Couldn't create a share link. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            SHARE
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            className="h-8 w-8 rounded-full border border-white/15 text-white/60 hover:text-white flex items-center justify-center shrink-0"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
              <path d="M6 6l12 12" />
              <path d="M18 6L6 18" />
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={handleImage}
          disabled={busy !== null}
          className="w-full rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
        >
          {busy === "image" ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-[#0e1b33]/40 border-t-[#0e1b33] animate-spin" />
              BUILDING&hellip;
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="M7 8l5-5 5 5" />
                <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
              </svg>
              SHARE AS IMAGE
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleLink}
          disabled={busy !== null}
          className="w-full mt-3 rounded-full px-5 py-2.5 text-sm border border-white/15 hover:border-white/30 text-white/70 hover:text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {busy === "link" ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              CREATING&hellip;
            </>
          ) : copied ? (
            "LINK COPIED"
          ) : (
            "SHARE A LINK"
          )}
        </button>

        {shareUrl && (
          <div className="mt-4">
            <p className="text-white/45 text-xs mb-1.5">Anyone with this link can see your list and make their own.</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Share link"
                className="flex-1 min-w-0 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white text-xs outline-none focus:border-white/35"
              />
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
      </div>
    </div>
  );
}
