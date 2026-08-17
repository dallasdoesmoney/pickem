"use client";

import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { updateAvatar, setPresetAvatar, markAvatarPrompted } from "@/lib/supabase/profile";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { TeamAvatarPicker } from "@/components/TeamAvatarPicker";
import { Team } from "@/data/teams";
import { errorMessage } from "@/lib/errorMessage";

const AVATAR_SIZE = 200;

// Mounted once, app-wide (see layout.tsx), right after UsernameGate in
// the same "first-run gate" family - shows itself once a username is
// set (its condition requires profile.username, so it can never appear
// before or alongside UsernameGate) but the prompt hasn't been
// dismissed yet, tracked by profiles.onboarding_avatar_prompted so it
// never nags twice. Unlike UsernameGate this is fully skippable - a
// profile photo helps but isn't required for anything downstream.
export function AvatarPromptGate() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const show = !loading && !!user && !!profile && !!profile.username && !profile.onboarding_avatar_prompted;
  if (!show) return null;

  async function finish() {
    await markAvatarPrompted(user!.id);
    await refreshProfile();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setCropFile(file);
  }

  async function handleCropConfirm(dataUrl: string) {
    setCropFile(null);
    setBusy(true);
    try {
      await updateAvatar(user!.id, dataUrl);
      await finish();
    } catch (err) {
      console.error("Avatar upload failed", err);
      setError(`Couldn't upload that photo: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectPreset(team: Team) {
    setBusy(true);
    setError(null);
    try {
      await setPresetAvatar(user!.id, team.logo);
      await finish();
    } catch (err) {
      console.error("Preset avatar save failed", err);
      setError(`Couldn't save that: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleKeepOrSkip() {
    setBusy(true);
    await finish();
    setBusy(false);
  }

  const hasPhoto = !!profile!.avatar_url;
  const primaryStyle = { fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" };
  const outlineClass = "border border-white/20 text-white/70 hover:text-white hover:border-white/40 transition-colors";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto flex flex-col items-center text-center">
        <span className="text-[10px] tracking-[0.2em] text-amber-300/80 mb-2">STEP 2 OF 2</span>
        <h2 className="text-white text-lg" style={{ fontFamily: "var(--font-display)" }}>
          {hasPhoto ? "NICE PHOTO!" : "ADD A PHOTO"}
        </h2>
        <p className="text-white/50 text-sm mt-1 mb-5">
          {hasPhoto
            ? "We grabbed this from your Google account. Keep it, or pick something else."
            : "Profiles with a photo get a lot more friend requests. Snap one, or grab a team logo."}
        </p>

        <div className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-white/20 bg-white/5 flex items-center justify-center mb-5 shrink-0">
          {profile!.avatar_url ? (
            <img src={profile!.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl text-white/30">+</span>
          )}
          {busy && (
            <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            </span>
          )}
        </div>

        {error && <p className="text-xs text-red-400 mb-3">{error}</p>}

        <div className="w-full flex flex-col gap-2">
          {hasPhoto && (
            <button
              type="button"
              onClick={handleKeepOrSkip}
              disabled={busy}
              className="w-full rounded-full px-5 py-2.5 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-40"
              style={primaryStyle}
            >
              KEEP THIS PHOTO
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className={`w-full rounded-full px-5 py-2.5 text-sm disabled:opacity-40 ${hasPhoto ? outlineClass : "active:scale-95 transition-transform duration-150"}`}
            style={hasPhoto ? { fontFamily: "var(--font-display)" } : primaryStyle}
          >
            UPLOAD A PHOTO
          </button>
          <button
            type="button"
            onClick={() => setPresetOpen((v) => !v)}
            disabled={busy}
            className={`w-full rounded-full px-5 py-2.5 text-sm disabled:opacity-40 ${outlineClass}`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            CHOOSE A TEAM LOGO
          </button>
        </div>

        {presetOpen && (
          <div className="w-full mt-4">
            <TeamAvatarPicker onSelect={handleSelectPreset} selectedLogo={profile!.avatar_url} />
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <button type="button" onClick={handleKeepOrSkip} disabled={busy} className="mt-4 text-xs text-white/35 hover:text-white/60 transition-colors disabled:opacity-40">
          Skip for now &rarr;
        </button>
      </div>

      {cropFile && <AvatarCropModal file={cropFile} outputSize={AVATAR_SIZE} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}
    </div>
  );
}
