"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/components/AccountMenu";
import { ReferralBanner } from "@/components/ReferralBanner";
import { NotificationToasts } from "@/components/NotificationToasts";
import { ReferrerSuggestionCard } from "@/components/ReferrerSuggestionCard";
import { useAuth } from "@/hooks/useAuth";
import { fetchUnreciprocatedFollowerCount } from "@/lib/supabase/follows";
import { fetchPendingCreatorRequestCount } from "@/lib/supabase/creatorRequests";
import { navParent } from "@/lib/navParent";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  matchPrefix: string;
};

// The four destinations, flat. There used to be an intermediate
// "Pick'em hub" page between the nav and the two pick'em modes; the home
// page now fronts all four directly, so a nav item that pointed at a
// menu of the same four links was a stop on the way to nowhere. Every
// entry here goes straight to the thing it names.
const NAV_ITEMS: NavItem[] = [
  { href: "/weekly", label: "Pick’em", icon: PicksIcon, matchPrefix: "/weekly" },
  { href: "/predictor", label: "Record Predictor", icon: TeamIcon, matchPrefix: "/predictor" },
  { href: "/tier-lists", label: "Tier Lists", icon: TierListIcon, matchPrefix: "/tier-lists" },
  { href: "/leaderboard", label: "Leaderboard", icon: LeaderboardIcon, matchPrefix: "/leaderboard" },
];

const MOBILE_STANDALONE_ITEMS: NavItem[] = [{ href: "/account", label: "Profile", icon: AccountIcon, matchPrefix: "/account" }];

function PicksIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function TeamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M8 14l2.5 2.5L16 11" />
    </svg>
  );
}

function TierListIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 5h11l3 2.5L14 10H3z" />
      <path d="M3 14h8l3 2.5L11 19H3z" />
    </svg>
  );
}

function LeaderboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4a3 3 0 0 0 3 4" />
      <path d="M17 6h3a3 3 0 0 1-3 4" />
      <path d="M12 17v4" />
      <path d="M8 21h8" />
    </svg>
  );
}

function NotificationsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function AccountIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  );
}

function HamburgerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M3 12h18" />
      <path d="M3 18h18" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </svg>
  );
}

// Plain pill links, not dropdowns - all four are single destinations, so
// none of them needs the anchored-menu machinery PickemMenu used to
// provide.
function TopNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[13px] transition-colors ${
        active ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {label}
    </Link>
  );
}

function MobileNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname.startsWith(item.matchPrefix);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        active ? "bg-white/10 text-white" : "text-white/55 hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[#4ade80]" : ""}`} />
      <span className="text-sm">{item.label}</span>
    </Link>
  );
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const { user, profile, signOut } = useAuth();
  const parent = navParent(usePathname());
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [adminTaskCount, setAdminTaskCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    fetchUnreciprocatedFollowerCount(user.id)
      .then(setPendingCount)
      .catch(() => {});
  }, [user, mobileOpen]);

  useEffect(() => {
    if (!profile?.is_admin) {
      setAdminTaskCount(0);
      return;
    }
    fetchPendingCreatorRequestCount()
      .then(setAdminTaskCount)
      .catch(() => {});
  }, [profile?.is_admin, mobileOpen]);

  return (
    <div className="flex min-h-full">
      {mobileOpen && (
        <div className="navbar:hidden fixed inset-0 z-[60] flex">
          <div className="w-64 bg-[#0b1730] border-r border-white/10 flex flex-col">
            <div className="flex items-center justify-between h-16 px-4">
              <img src="/press-logo.png" alt="Sideline Brew" className="h-12 w-auto" />
              <button
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 rounded-full border border-white/15 text-white/60 flex items-center justify-center"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>
            {/* Flat, no section heading: the four items ARE the app, and
                the heading that used to sit above them said "Pick'em" -
                which is now also the name of one of the items under it. */}
            <nav className="flex flex-col gap-4 px-3">
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <MobileNavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
                ))}
              </div>
              <div className="flex flex-col gap-1 pt-3 border-t border-white/10">
                {user ? (
                  <>
                    <Link
                      href="/account"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/85 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
                      ) : (
                        <AccountIcon className="h-5 w-5 shrink-0" />
                      )}
                      <span className="text-sm truncate">{profile?.username || user.email}</span>
                    </Link>
                    <Link
                      href="/notifications"
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <NotificationsIcon className="h-5 w-5 shrink-0" />
                      <span className="text-sm flex-1">Notifications</span>
                      {pendingCount > 0 && <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />}
                    </Link>
                    {profile?.is_admin && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <span className="text-sm flex-1">Admin</span>
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
                      onClick={() => {
                        setMobileOpen(false);
                        signOut();
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-sm">Sign out</span>
                    </button>
                  </>
                ) : (
                  MOBILE_STANDALONE_ITEMS.map((item) => <MobileNavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />)
                )}
              </div>
            </nav>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-50 relative flex shrink-0 items-center justify-center px-4 navbar:px-6 h-[72px] border-b border-white/10 bg-[#070e1c]/90 backdrop-blur">
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="navbar:hidden absolute left-4 h-9 w-9 shrink-0 rounded-full border border-white/15 text-white/70 flex items-center justify-center"
          >
            <HamburgerIcon className="h-5 w-5" />
          </button>

          <div className="hidden navbar:flex items-center gap-0.5 absolute left-6">
            {NAV_ITEMS.map((item) => (
              <TopNavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </div>

          <Link href="/" aria-label="Go to the homepage">
            <img src="/header-logo.png" alt="Sideline Brew" className="h-16 w-auto" />
          </Link>

          <div className="absolute right-6">
            <AccountMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen} />
          </div>
        </div>
        {/* The way back up, on a rail pinned under the header.
            Started on the tier list page, where the only exit was a bare
            chevron on a row that scrolled away. It turns out every page
            had the same problem in a milder form: the four sections and
            home were reachable only through the hamburger, which is an
            overlay you have to open before you can even see your
            options. This is always on screen and costs one tap.
            Hidden on home, which has no parent - see navParent.
            shrink-0 is load-bearing: this is a fixed-height child of a
            flex column, so the default flex-shrink:1 let a tall page
            squash it - the predictor's team pages crushed it from 34px
            to 19.75, and the label with it. */}
        {parent && (
          <div className="sticky top-[72px] z-30 flex h-[34px] shrink-0 items-center border-b border-white/10 bg-[#070e1c] px-4 navbar:px-6">
            <Link
              href={parent.href}
              className="flex items-center gap-1.5 text-[12.5px] tracking-[0.15em] text-white/60 transition-colors hover:text-white"
              style={{ fontFamily: "var(--font-display)" }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {parent.label.toUpperCase()}
            </Link>
          </div>
        )}
        <ReferralBanner />
        <ReferrerSuggestionCard />
        <NotificationToasts />
        {children}
      </div>
    </div>
  );
}
