"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 200;

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

// Desktop-only account control in the header. Signed-out stays a plain
// link to /account (same as before accounts existed); signed-in swaps to
// an anchored dropdown (same portal pattern as PickemMenu/TeamSwitcher)
// showing who's signed in plus a Sign Out action, so signing out doesn't
// require a trip to the account page.
export function AccountMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, profile, signOut } = useAuth();
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);

  if (!user) {
    return (
      <Link
        href="/account"
        className="hidden lg:flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <AccountIcon className="h-5 w-5" />
        Account
      </Link>
    );
  }

  const name = profile?.username || user.email || "Account";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="hidden lg:block relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="h-7 w-7 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">{initial}</span>
        )}
        <span className="max-w-[120px] truncate">{name}</span>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="fixed z-[100] rounded-2xl border border-white/10 bg-[#101d38] shadow-2xl shadow-black/60 p-2"
          >
            <Link
              href="/account"
              role="menuitem"
              onClick={() => onOpenChange(false)}
              className="block rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Account
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onOpenChange(false);
                signOut();
              }}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Sign out
            </button>
          </div>,
          document.body
        )}
    </div>
  );
}
