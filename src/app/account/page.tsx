"use client";

import { useRef, useState } from "react";
import { useProfile } from "@/hooks/useProfile";

const AVATAR_SIZE = 200;

function resizeToSquareDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d context unavailable"));
        return;
      }
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

export default function AccountPage() {
  const { profile, setProfile, loaded } = useProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeToSquareDataUrl(file);
      setProfile((p) => ({ ...p, avatarDataUrl: dataUrl }));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-2xl w-full mx-auto">
      <h1 className="text-4xl text-center" style={{ fontFamily: "var(--font-display)" }}>
        ACCOUNT
      </h1>
      <p className="text-center text-white/50 text-sm mt-2 mb-10">
        Full sign-in and cross-device sync are coming soon. For now, your profile is saved on this device.
      </p>

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
              {uploading && (
                <span className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                </span>
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-white/50 hover:text-white">
              {profile.avatarDataUrl ? "Change photo" : "Add photo"}
            </button>
          </div>

          <label className="w-full flex flex-col gap-2">
            <span className="text-xs text-white/50 tracking-wide">DISPLAY NAME</span>
            <input
              value={profile.displayName}
              onChange={(e) => setProfile((p) => ({ ...p, displayName: e.target.value }))}
              placeholder="Your name"
              className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
            />
          </label>

          <div className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center">
            <p className="text-sm text-white/60">Sign-in (Google / email) is on the way.</p>
            <button disabled className="mt-3 rounded-full px-5 py-2 text-sm border border-white/15 text-white/40 cursor-not-allowed">
              Sign in &mdash; coming soon
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
