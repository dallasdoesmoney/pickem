"use client";

import { useEffect, useState } from "react";
import { fetchMyCreatorRequest, submitCreatorRequest, CreatorRequest } from "@/lib/supabase/creatorRequests";
import { errorMessage } from "@/lib/errorMessage";

// One-time submit, not per-field saves like EditProfileModal - this is a
// request, not an editable profile field. On open, checks for an
// existing request first: pending shows a status message, rejected
// shows the form again for resubmission, approved falls back to a
// confirmation (shouldn't normally be reachable since the launch point
// on the account page disappears once you're already a creator).
export function CreatorRequestModal({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const [existing, setExisting] = useState<CreatorRequest | null | undefined>(undefined);
  const [contentUrl, setContentUrl] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setExisting(undefined);
    setContentUrl("");
    setNote("");
    setSubmitError(null);
    setLoadError(null);
    fetchMyCreatorRequest(userId)
      .then(setExisting)
      .catch((err) => {
        console.error("Failed to load creator request status", errorMessage(err));
        setLoadError("Couldn't load your request status.");
      });
  }, [open, userId]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!contentUrl.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const { error } = await submitCreatorRequest(userId, contentUrl.trim(), note.trim());
    setSubmitting(false);
    if (error) {
      setSubmitError(error);
      return;
    }
    fetchMyCreatorRequest(userId).then(setExisting);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            BECOME A CREATOR
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

        {loadError ? (
          <p className="text-sm text-red-400">{loadError}</p>
        ) : existing === undefined ? (
          <div className="flex justify-center py-8">
            <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        ) : existing?.status === "pending" ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🎥</div>
            <p className="text-sm text-white/70">Your request is pending review. We&rsquo;ll notify you once it&rsquo;s reviewed.</p>
          </div>
        ) : existing?.status === "approved" ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-3">🎥</div>
            <p className="text-sm text-white/70">You&rsquo;re already a Creator!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <p className="text-sm text-white/50 -mt-1 mb-1">
              Stream or make content about Sideline Brew? Request the Creator badge for your profile.
            </p>
            {existing?.status === "rejected" && <p className="text-xs text-amber-300/80">Your last request wasn&rsquo;t approved - feel free to try again.</p>}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-white/50 tracking-wide">LINK TO YOUR CHANNEL/STREAM</span>
              <input
                type="url"
                required
                value={contentUrl}
                onChange={(e) => setContentUrl(e.target.value)}
                placeholder="https://twitch.tv/yourname"
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-white/50 tracking-wide">ANYTHING ELSE WE SHOULD KNOW? (OPTIONAL)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Tell us about your content..."
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35 resize-none"
              />
            </div>

            {submitError && <p className="text-xs text-red-400">{submitError}</p>}

            <button
              type="submit"
              disabled={!contentUrl.trim() || submitting}
              className="mt-1 rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50"
              style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
            >
              {submitting ? "SUBMITTING…" : "SUBMIT REQUEST"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
