"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchPendingCreatorRequestCount } from "@/lib/supabase/creatorRequests";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";
import { fetchUnreciprocatedFollowerCount } from "@/lib/supabase/follows";
import { fetchMyLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { LevelsAchievementsModal } from "@/components/LevelsAchievementsModal";

const PANEL_WIDTH = 200;

// One size for every state of this control, so the header's right edge
// never shifts as the session resolves or as you sign in and out.
const AVATAR_SIZE = "h-8 w-8 lg:h-7 lg:w-7";

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

// Account control in the header, in every state.
//
// One shape in one place at every width - a 32px circle in the top right
// corner - and only the amount of detail inside it changes: your photo,
// or your initial, or a dashed outline held open for you. The word
// beside it appears wherever there is room for it, which is the same
// rule signed-in already followed (avatar alone on a phone, avatar plus
// your username on a desktop).
//
// Signed-out used to be desktop-only, which meant that on a phone the
// corner was empty - a zero-pixel-wide slot - and the only route to an
// account was buried in the hamburger drawer. That was the whole reason
// to touch this.
//
// Signed-in shows an anchored dropdown (same portal pattern as
// PickemMenu/TeamSwitcher) on every breakpoint, so signing out or
// jumping to the profile doesn't require opening the hamburger first.
export function AccountMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, profile, loading, signOut } = useAuth();
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const [pendingCount, setPendingCount] = useState(0);
  // Admin's own queue, separate from the follower count above it. Fetched
  // here rather than only inside /admin so an admin sees work waiting
  // without having to go looking for it.
  const [adminTaskCount, setAdminTaskCount] = useState(0);
  // Challenges were previously reachable only by finding your level and
  // then noticing the tab beside it, which is a lot of steps for the
  // screen that answers "what can I do to earn points."
  const [challengesOpen, setChallengesOpen] = useState(false);
  // Only for the Levels tab's you-are-here marker, so it is fetched when
  // the modal is opened rather than every time the menu is - the modal
  // lands on Challenges, and by the time anyone switches tabs this has
  // long since arrived.
  const [totalPoints, setTotalPoints] = useState<number | undefined>(undefined);

  function openChallenges() {
    onOpenChange(false);
    setChallengesOpen(true);
    if (user) {
      fetchMyLeaderboardEntry(user.id)
        .then((row) => setTotalPoints(row?.total_points))
        .catch(() => {});
    }
  }

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

  // Hold the slot with a plain disc until the session resolves. Without
  // this the header renders the signed-out control first and swaps it a
  // moment later, so every signed-in visit began with the corner
  // flickering from "sign in" to your own face.
  if (loading) {
    return <span aria-hidden className={`${AVATAR_SIZE} block rounded-full bg-white/[0.07]`} />;
  }

  if (!user) {
    return (
      <Link
        href="/account"
        aria-label="Sign in"
        className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors"
        style={{ fontFamily: "var(--font-display)" }}
      >
        <span className="relative shrink-0">
          {/* Dashed, not solid: a solid disc with a glyph in it reads as
              somebody's account - a broken image, or a stranger's. An
              outline reads as a shape nobody has filled in yet. */}
          <span
            className={`${AVATAR_SIZE} flex items-center justify-center rounded-full border-[1.5px] border-dashed border-white/30 bg-white/[0.04] text-white/45`}
          >
            <AccountIcon className="h-4 w-4" />
          </span>
          {/* Sits in the same corner the unread dot uses when you're
              signed in. The two never appear together - one belongs to
              having an account and the other to not having one - and it
              is what keeps the empty circle reading as somewhere to go
              rather than as something that failed to load. */}
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-[#070e1c] bg-emerald-400 text-[#070e1c]">
            <svg viewBox="0 0 24 24" className="h-2 w-2" fill="none" stroke="currentColor" strokeWidth={5} strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
        </span>
        {/* Same rule as the username beside your avatar once you're in:
            shown wherever the header has room to spell it out. */}
        <span className="hidden lg:inline">Sign in</span>
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
            <img src={profile.avatar_url} alt="" className={`${AVATAR_SIZE} rounded-full object-cover`} />
          ) : (
            <span className={`${AVATAR_SIZE} shrink-0 rounded-full bg-white/10 flex items-center justify-center text-xs`}>{initial}</span>
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
            {/* Directly under Profile, because this is the thing people
                are actually looking for when they go looking for their
                profile: not who they are, but what is left to do. */}
            <button
              type="button"
              role="menuitem"
              onClick={openChallenges}
              className="w-full text-left rounded-xl px-3 py-2.5 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Daily Challenges
            </button>
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

      {/* Portalled to the body, and it has to be.

          The header this menu sits in has backdrop-blur, and a
          backdrop-filter makes that element the containing block for any
          fixed-position descendant. So the modal's `fixed inset-0`
          resolved to the header's 72px strip rather than the viewport: it
          centred itself on that strip with its top hanging off-screen,
          and its backdrop dimmed only the header. Portalling out is what
          gets it back to the viewport - the same reason the menu panel
          above is portalled.

          It also has to sit outside that panel's `open && coords` portal,
          for a different reason: closing the menu is the first thing
          openChallenges does, so a modal rendered inside would unmount in
          the same tick it was asked for.

          challengesOpen is false until a click, so this never runs during
          SSR where document does not exist. */}
      {challengesOpen &&
        createPortal(
          <LevelsAchievementsModal
            open
            initialTab="achievements"
            totalPoints={totalPoints}
            onClose={() => setChallengesOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}
