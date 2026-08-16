"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PickemMenu } from "@/components/PickemMenu";
import { AccountMenu } from "@/components/AccountMenu";
import { LevelsAchievementsModal } from "@/components/LevelsAchievementsModal";
import { useAuth } from "@/hooks/useAuth";
import { fetchPendingRequestCount } from "@/lib/supabase/friends";
import { fetchMyLeaderboardEntry } from "@/lib/supabase/leaderboard";
import { getLevelInfo } from "@/lib/levels";

type NavItem = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  matchPrefix: string;
  exact?: boolean;
};

type NavSection = { label: string; items: NavItem[] };

// Grouped the same way the desktop "Pick'em" dropdown groups its two
// pages - on mobile that grouping was missing entirely (every page just
// flattened into one list), which won't scale as more page groups get
// added later. Account stands alone here too, matching how it sits
// outside the Pick'em dropdown on desktop.
const MOBILE_NAV_SECTIONS: NavSection[] = [
  {
    label: "Pick’em",
    items: [
      { href: "/", label: "Weekly Pick’em", icon: PicksIcon, matchPrefix: "/", exact: true },
      { href: "/predictor", label: "Team Pick’em", icon: PredictorIcon, matchPrefix: "/predictor" },
      { href: "/leaderboard", label: "Leaderboard", icon: LeaderboardIcon, matchPrefix: "/leaderboard" },
    ],
  },
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

function PredictorIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M8 13l2.5 2.5L16 10" />
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

function AchievementsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M9 13.5L7 22l5-3 5 3-2-8.5" />
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

function MobileNavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.matchPrefix);
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pickemMenuOpen, setPickemMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [currentLevel, setCurrentLevel] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!user) {
      setPendingCount(0);
      return;
    }
    fetchPendingRequestCount(user.id)
      .then(setPendingCount)
      .catch(() => {});
  }, [user, mobileOpen]);

  useEffect(() => {
    if (!user) {
      setCurrentLevel(undefined);
      return;
    }
    fetchMyLeaderboardEntry(user.id)
      .then((row) => setCurrentLevel(row ? getLevelInfo(row.total_points).level : undefined))
      .catch(() => {});
  }, [user]);

  return (
    <div className="flex min-h-full">
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
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
            <nav className="flex flex-col gap-4 px-3">
              {MOBILE_NAV_SECTIONS.map((section) => (
                <div key={section.label} className="flex flex-col gap-1">
                  <div
                    className="px-3 text-[11px] text-white/35 tracking-[0.15em] uppercase"
                    style={{ fontFamily: "var(--font-display)" }}
                  >
                    {section.label}
                  </div>
                  {section.items.map((item) => (
                    <MobileNavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
                  ))}
                </div>
              ))}
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
                    <button
                      type="button"
                      onClick={() => {
                        setMobileOpen(false);
                        setAchievementsOpen(true);
                      }}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 hover:text-white hover:bg-white/5 transition-colors text-left"
                    >
                      <AchievementsIcon className="h-5 w-5 shrink-0" />
                      <span className="text-sm">Achievements</span>
                    </button>
                    {profile?.is_admin && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/55 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        <span className="text-sm">Admin</span>
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
        <div className="sticky top-0 z-50 relative flex items-center justify-center px-4 lg:px-6 h-[72px] border-b border-white/10 bg-[#0e1b33]/90 backdrop-blur">
          <button
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="lg:hidden absolute left-4 h-9 w-9 shrink-0 rounded-full border border-white/15 text-white/70 flex items-center justify-center"
          >
            <HamburgerIcon className="h-5 w-5" />
          </button>

          <div className="hidden lg:block absolute left-6">
            <PickemMenu open={pickemMenuOpen} onOpenChange={setPickemMenuOpen} />
          </div>

          <Link href="/" aria-label="Go to the homepage">
            <img src="/header-logo.png" alt="Sideline Brew" className="h-16 w-auto" />
          </Link>

          <div className="absolute right-6">
            <AccountMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen} />
          </div>
        </div>
        {children}
      </div>
      <LevelsAchievementsModal open={achievementsOpen} initialTab="achievements" currentLevel={currentLevel} onClose={() => setAchievementsOpen(false)} />
    </div>
  );
}
