"use client";

import { useEffect, useRef, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth, type Profile } from "@/hooks/useAuth";
import { useSignInModal } from "@/hooks/useSignInModal";
import { useUsernameField } from "@/hooks/useUsernameField";
import { updateAvatar, claimUsername, updateDisplayName } from "@/lib/supabase/profile";
import { USERNAME_MIN, USERNAME_MAX } from "@/lib/usernamePolicy";
import { validateDisplayName, DISPLAY_NAME_MAX } from "@/lib/displayNamePolicy";
import { AvatarCropModal } from "@/components/AvatarCropModal";
import { errorMessage } from "@/lib/errorMessage";

const AVATAR_SIZE = 200;

export default function AccountPage() {
  const { user, profile: authProfile, loading: authLoading, signOut, refreshProfile } = useAuth();

  if (authLoading) {
    return (
      <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto flex items-center justify-center">
        <span className="h-6 w-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
      </main>
    );
  }

  return user ? (
    <SignedInAccount userId={user.id} email={user.email ?? ""} authProfile={authProfile} onSignOut={signOut} onProfileChange={refreshProfile} />
  ) : (
    <SignedOutAccount />
  );
}

function SignedInAccount({
  userId,
  email,
  authProfile,
  onSignOut,
  onProfileChange,
}: {
  userId: string;
  email: string;
  authProfile: Profile | null;
  onSignOut: () => Promise<void>;
  onProfileChange: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const { username, setUsername, status } = useUsernameField(authProfile?.username);
  const [initializedUsername, setInitializedUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameSaved, setUsernameSaved] = useState(false);

  useEffect(() => {
    if (!initializedUsername && authProfile?.username) {
      setUsername(authProfile.username);
      setInitializedUsername(true);
    }
  }, [authProfile?.username, initializedUsername, setUsername]);

  const [displayName, setDisplayName] = useState(authProfile?.display_name ?? "");
  const [initializedDisplayName, setInitializedDisplayName] = useState(false);
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [displayNameSaved, setDisplayNameSaved] = useState(false);

  useEffect(() => {
    if (!initializedDisplayName && authProfile) {
      setDisplayName(authProfile.display_name);
      setInitializedDisplayName(true);
    }
  }, [authProfile, initializedDisplayName]);

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
      await onProfileChange();
    } catch (err) {
      console.error("Avatar upload failed", err);
      const detail = errorMessage(err);
      setAvatarError(`Couldn't upload that photo: ${detail}`);
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
    setTimeout(() => setUsernameSaved(false), 2000);
    await onProfileChange();
  }

  const hintColor = status === "available" ? "#4ade80" : status === "taken" || status === "invalid" ? "#f87171" : "rgba(255,255,255,0.4)";

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto">
      <h1 className="text-4xl text-center" style={{ fontFamily: "var(--font-display)" }}>
        ACCOUNT
      </h1>
      <p className="text-center text-white/50 text-sm mt-2 mb-10">{email}</p>

      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-white/20 bg-white/5 flex items-center justify-center"
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
          <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/50 hover:text-white">
            {authProfile?.avatar_url ? "Change photo" : "Add photo"}
          </button>
          {avatarError && <p className="text-xs text-red-400 text-center max-w-xs">{avatarError}</p>}
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

        <button
          onClick={() => onSignOut()}
          className="text-xs text-white/40 hover:text-white/70 rounded-full px-5 py-2 border border-white/15 hover:border-white/30 transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
        >
          SIGN OUT
        </button>
      </div>

      {cropFile && <AvatarCropModal file={cropFile} outputSize={AVATAR_SIZE} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}
    </main>
  );
}

function SignedOutAccount() {
  const { profile, setProfile, loaded } = useProfile();
  const { requestSignIn, signInModal } = useSignInModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropFile(file);
  }

  function handleCropConfirm(dataUrl: string) {
    setCropFile(null);
    setProfile((p) => ({ ...p, avatarDataUrl: dataUrl }));
  }

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto">
      <h1 className="text-4xl text-center" style={{ fontFamily: "var(--font-display)" }}>
        ACCOUNT
      </h1>
      <p className="text-center text-white/50 text-sm mt-2 mb-10">Sign in to choose a username and save your picks across devices.</p>

      {loaded && (
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative h-28 w-28 rounded-full overflow-hidden border-2 border-white/20 bg-white/5 flex items-center justify-center"
              aria-label="Change profile picture"
            >
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-3xl text-white/30">+</span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/50 hover:text-white">
              {profile.avatarDataUrl ? "Change photo" : "Add photo"}
            </button>
          </div>

          <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
            <p className="text-sm text-white/60">Signing in lets you pick a username and syncs this profile to your account.</p>
            <button
              onClick={() => requestSignIn()}
              className="mt-3 rounded-full px-6 py-2.5 text-sm active:scale-95 transition-transform duration-150"
              style={{ fontFamily: "var(--font-display)", background: "linear-gradient(135deg, #34d399, #059669)", color: "#ffffff" }}
            >
              SIGN IN
            </button>
          </div>
        </div>
      )}
      {signInModal}
      {cropFile && <AvatarCropModal file={cropFile} outputSize={AVATAR_SIZE} onCancel={() => setCropFile(null)} onConfirm={handleCropConfirm} />}
    </main>
  );
}
