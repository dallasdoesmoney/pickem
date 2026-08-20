"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchPendingCreatorRequestCount } from "@/lib/supabase/creatorRequests";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";
import { fetchUnreciprocatedFollowerCount } from "@/lib/supabase/follows";

const PANEL_WIDTH = 200;

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

// Account control in the header. Signed-out stays desktop-only (a plain
// link to /account, same as before accounts existed - mobile already has
// a "Profile" row in the hamburger drawer). Signed-in shows an anchored
// dropdown (same portal pattern as PickemMenu/TeamSwitcher) on every
// breakpoint - avatar only on mobile, avatar + name on desktop - so
// signing out or jumping to the profile doesn't require opening the
// hamburger menu first.
export function AccountMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, profile, signOut } = useAuth();
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const [pendingCount, setPendingCount] = useState(0);
  // Admin's own queue, separate from the follower count above it. Fetched
  // here rather than only inside /admin so an admin sees work waiting
  // without having to go looking for it.
  const [adminTaskCount, setAdminTaskCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    fetchUnreciprocatedFollowerCount(user.id)
      .then(setPendingCount)
      .catch(() => {});
  }, [user, open]);

  useEffect(() => {
    if (!profile?.is_admin) {
      setAdminTaskCount(0);
      return;
    }
    fetchPendingCreatorRequestCount()
      .then(setAdminTaskCount)
      .catch(() => {});
  }, [profile?.is_admin, open]);

  if (!user) {
    return (
      <Link
        href="/account"
        className="hidden lg:flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <AccountIcon className="h-5 w-5" />
        Profile
      </Link>
    );
  }

  const name = profile?.username || user.email || "Account";
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex items-center gap-2 rounded-full lg:pl-1 lg:pr-3 py-1 text-sm text-white/80 hover:text-white hover:bg-white/5 transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span className="relative shrink-0">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-8 w-8 lg:h-7 lg:w-7 rounded-full object-cover" />
          ) : (
            <span className="h-8 w-8 lg:h-7 lg:w-7 shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs">{initial}</span>
          )}
          {/* Fires for either queue: without this the admin count is only
              visible once the menu is already open, which defeats it. */}
          {pendingCount + adminTaskCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500 border border-[#070e1c]" />
          )}
        </span>
        {/* Name stays desktop-only - mobile's header is tight enough that
            the avatar alone (tappable, same dropdown) is the whole point;
            the hamburger drawer already spells the name out in full. */}
        <span className="hidden lg:inline max-w-[120px] truncate">{name}</span>
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
              Profile
            </Link>
            <Link
              href="/notifications"
              role="menuitem"
              onClick={() => onOpenChange(false)}
              className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Notifications
              {pendingCount > 0 && (
                <span className="h-2 w-2 rounded-full bg-red-500" />
              )}
            </Link>
            {profile?.is_admin && (
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => onOpenChange(false)}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Admin
                {adminTaskCount > 0 && (
                  <span
                    aria-label={`${adminTaskCount} waiting for review`}
                    className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] text-white"
                  >
                    {adminTaskCount}
                  </span>
                )}
              </Link>
            )}
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
