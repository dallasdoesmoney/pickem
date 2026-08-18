"use client";

import { useEffect, useState } from "react";
import { fetchCreatorLinks, addCreatorLink, removeCreatorLink, CreatorLink } from "@/lib/supabase/creatorLinks";
import { SOCIAL_PLATFORM_CATALOG } from "@/lib/socialPlatforms";
import { errorMessage } from "@/lib/errorMessage";

// Creator-only (the launch point on the account page is already gated
// on the badge; RLS enforces it server-side too via creator_links'
// insert policy). One platform per row - editing is delete-then-readd
// in this UI rather than a separate update flow, since the add form
// already only offers platforms you haven't used yet.
export function SocialLinksModal({ userId, open, onClose }: { userId: string; open: boolean; onClose: () => void }) {
  const [links, setLinks] = useState<CreatorLink[] | null>(null);
  const [platform, setPlatform] = useState<string>(Object.keys(SOCIAL_PLATFORM_CATALOG)[0]);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLinks(null);
    fetchCreatorLinks(userId)
      .then(setLinks)
      .catch((err) => {
        console.error("Failed to load creator links", errorMessage(err));
        setError("Couldn't load your links.");
      });
  }

  useEffect(() => {
    if (!open) return;
    setUrl("");
    setError(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId]);

  // Keep the platform select pointed at something still available once
  // links load or change (e.g. after adding one, that platform drops off
  // the list).
  useEffect(() => {
    if (!links) return;
    const available = Object.keys(SOCIAL_PLATFORM_CATALOG).filter((key) => !links.some((l) => l.platform === key));
    setPlatform((prev) => (available.includes(prev) ? prev : (available[0] ?? "")));
  }, [links]);

  if (!open) return null;

  const availablePlatforms = Object.entries(SOCIAL_PLATFORM_CATALOG).filter(([key]) => !links?.some((l) => l.platform === key));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !platform || saving) return;
    setSaving(true);
    setError(null);
    const { error } = await addCreatorLink(userId, platform, url.trim());
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    setUrl("");
    load();
  }

  async function handleRemove(linkId: string) {
    setRemovingId(linkId);
    setError(null);
    const { error } = await removeCreatorLink(linkId);
    setRemovingId(null);
    if (error) {
      setError(error);
      return;
    }
    load();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            SOCIAL LINKS
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

        {!links ? (
          <div className="flex justify-center py-8">
            <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {links.length > 0 && (
              <div className="flex flex-col gap-2">
                {links.map((link) => {
                  const def = SOCIAL_PLATFORM_CATALOG[link.platform] ?? { label: link.platform, icon: "🔗" };
                  return (
                    <div key={link.id} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
                      <span className="text-base shrink-0">{def.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-white/45">{def.label}</div>
                        <div className="text-sm truncate">{link.url}</div>
                      </div>
                      <button
                        onClick={() => handleRemove(link.id)}
                        disabled={removingId === link.id}
                        aria-label={`Remove ${def.label} link`}
                        className="shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-white/40 hover:text-white/70 transition-colors disabled:opacity-50"
                      >
                        {removingId === link.id ? "…" : "✕"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {error && <p className="text-xs text-red-400">{error}</p>}

            {availablePlatforms.length > 0 ? (
              <form onSubmit={handleAdd} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-white/50 tracking-wide">PLATFORM</span>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm outline-none focus:border-white/35"
                  >
                    {availablePlatforms.map(([key, def]) => (
                      <option key={key} value={key} className="bg-[#0b1730]">
                        {def.icon} {def.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-white/50 tracking-wide">LINK</span>
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://..."
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-white text-sm placeholder:text-white/30 outline-none focus:border-white/35"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!url.trim() || saving}
                  className="rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-50"
                  style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
                >
                  {saving ? "ADDING…" : "ADD LINK"}
                </button>
              </form>
            ) : (
              <p className="text-xs text-white/40 text-center">All platforms added.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
