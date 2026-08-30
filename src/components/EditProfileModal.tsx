"use client";

import { useEffect, useRef, useState } from "react";
import posthog from "posthog-js";
import { type Profile } from "@/hooks/useAuth";
import { useUsernameField } from "@/hooks/useUsernameField";
import { updateAvatar, setPresetAvatar, claimUsername, updateDisplayName } from "@/lib/supabase/profile";
import { USERNAME_MIN, USERNAME_MAX } from "@/lib/usernamePolicy";
import { validateDisplayName, DISPLAY_NAME_MAX } from "@/lib/displayNamePolicy";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { TeamAvatarPicker } from "@/components/TeamAvatarPicker";
import { Team } from "@/data/teams";
import { errorMessage } from "@/lib/errorMessage";

const AVATAR_SIZE = 200;

// Everything that changes the profile (photo, display name, username)
// lives behind this one modal, reached only via the pencil/Edit Profile
// affordance - the account page itself is a clean read-only view, not a
// form.
export function EditProfileModal({
  userId,
  authProfile,
  onClose,
  onProfileChange,
}: {
  userId: string;
  authProfile: Profile | null;
  onClose: () => void;
  onProfileChange: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);

  const { username, setUsername, status } = useUsernameField(authProfile?.username);
  const [initializedUsername, setInitializedUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);

  // SEEDED DURING RENDER, not in an effect. The profile arrives
  // asynchronously, so the field cannot be initialised from it - but an
  // effect meant one committed render with the box empty before the name
  // appeared in it, which reads as a flicker on a slow connection.
  // Setting during render makes React re-run the component and commit
  // only the version that already has the name.
  if (!initializedUsername && authProfile?.username) {
    setInitializedUsername(true);
    setUsername(authProfile.username);
  }

  const [displayName, setDisplayName] = useState(authProfile?.display_name ?? "");
  const [initializedDisplayName, setInitializedDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

  // Same seeding as the username above.
  if (!initializedDisplayName && authProfile) {
    setInitializedDisplayName(true);
    setDisplayName(authProfile.display_name);
  }

  const displayNameCheck = displayName === (authProfile?.display_name ?? "") ? null : validateDisplayName(displayName);

  async function handleSaveDisplayName() {
    if (!displayNameCheck?.valid || savingDisplayName) return;
    setSavingDisplayName(true);
    setDisplayNameError(null);
    const { error } = await updateDisplayName(userId, displayName.trim());
    setSavingDisplayName(false);
    if (error) {
      setDisplayNameError(error);
      return;
    }
    setDisplayNameSaved(true);
    posthog.capture("profile_display_name_updated");
    setTimeout(() => setDisplayNameSaved(false), 2000);
    await onProfileChange();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    setCropFile(file);
  }

  async function handleCropConfirm(dataUrl: string) {
    setCropFile(null);
    setUploading(true);
    try {
      await updateAvatar(userId, dataUrl);
      posthog.capture("profile_avatar_updated", { avatar_source: "photo" });
      await onProfileChange();
    } catch (err) {
      console.error("Avatar upload failed", err);
      const detail = errorMessage(err);
      setAvatarError(`Couldn't upload that photo: ${detail}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSelectPreset(team: Team) {
    setUploading(true);
    setAvatarError(null);
    try {
      await setPresetAvatar(userId, team.logo);
      posthog.capture("profile_avatar_updated", { avatar_source: "team_logo" });
      await onProfileChange();
      setPresetOpen(false);
    } catch (err) {
      console.error("Preset avatar save failed", err);
      setAvatarError(`Couldn't save that: ${errorMessage(err)}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveUsername() {
    if (status !== "available" || savingUsername) return;
    setSavingUsername(true);
    setUsernameError(null);
    const { error } = await claimUsername(userId, username);
    setSavingUsername(false);
    if (error) {
      setUsernameError(error);
      return;
    }
    setUsernameSaved(true);
    posthog.capture("profile_username_claimed");
    setTimeout(() => setUsernameSaved(false), 2000);
    await onProfileChange();
  }

  const hintColor = status === "available" ? "#4ade80" : status === "taken" || status === "invalid" ? "#f87171" : "rgba(255,255,255,0.4)";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/15 bg-[#0b1730] p-6 shadow-2xl shadow-black/50 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
            EDIT PROFILE
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

        <div className="flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative h-24 w-24 rounded-full overflow-hidden border-2 border-white/20 bg-white/5 flex items-center justify-center"
              aria-label="Change profile picture"
            >
              {authProfile?.avatar_url ? (
                <img src={authProfile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl text-white/30">+</span>
              )}
              {uploading && (
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                </span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <div className="flex items-center gap-2.5">
              <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/50 hover:text-white">
                {authProfile?.avatar_url ? "Change photo" : "Add photo"}
              </button>
              <span className="text-white/20 text-xs">&middot;</span>
              <button onClick={() => setPresetOpen((v) => !v)} className="text-xs text-white/50 hover:text-white">
                Choose team logo
              </button>
            </div>
            {avatarError && <p className="text-xs text-red-400 text-center max-w-xs">{avatarError}</p>}
            {presetOpen && (
              <div className="w-full pt-1">
                <TeamAvatarPicker onSelect={handleSelectPreset} selectedLogo={authProfile?.avatar_url} />
              </div>
            )}
          </div>

          <div className="w-full flex flex-col gap-2">
            <span className="text-xs text-white/50 tracking-wide">DISPLAY NAME</span>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={DISPLAY_NAME_MAX}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
              <button
                onClick={handleSaveDisplayName}
                disabled={!displayNameCheck?.valid || savingDisplayName}
                className="shrink-0 rounded-xl px-4 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-40"
                style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
              >
                {savingDisplayName ? "…" : displayNameSaved ? "Saved" : "Save"}
              </button>
            </div>
            <p className="text-xs h-4" style={{ color: displayNameCheck && !displayNameCheck.valid ? "#f87171" : "rgba(255,255,255,0.4)" }}>
              {displayNameCheck && !displayNameCheck.valid ? displayNameCheck.reason : "Shown on the leaderboard - doesn’t need to be unique."}
            </p>
            {displayNameError && <p className="text-xs text-red-400 -mt-2">{displayNameError}</p>}
          </div>

          <div className="w-full flex flex-col gap-2">
            <span className="text-xs text-white/50 tracking-wide">USERNAME</span>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.trim())}
                placeholder="username"
                maxLength={USERNAME_MAX}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
              />
              <button
                onClick={handleSaveUsername}
                disabled={status !== "available" || savingUsername}
                className="shrink-0 rounded-xl px-4 text-sm active:scale-95 transition-transform duration-150 disabled:opacity-40"
                style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #4ade80, #22c55e)", color: "#0e1b33" }}
              >
                {savingUsername ? "…" : usernameSaved ? "Saved" : "Save"}
              </button>
            </div>
            <p className="text-xs h-4" style={{ color: hintColor }}>
              {status === "checking" && "Checking…"}
              {status === "available" && "Available"}
              {status === "taken" && "That username is taken"}
              {status === "invalid" && `${USERNAME_MIN}-${USERNAME_MAX} characters: letters, numbers, underscores only`}
            </p>
            {usernameError && <p className="text-xs text-red-400 -mt-2">{usernameError}</p>}
          </div>
        </div>
      </div>

      {cropFile && <AvatarCropModal file={cropFile} outputSize={AVATAR_SIZE} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}
    </div>
  );
}
