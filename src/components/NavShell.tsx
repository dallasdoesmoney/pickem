"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { PickemMenu } from "@/components/PickemMenu";

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
    ],
  },
];

const MOBILE_STANDALONE_ITEMS: NavItem[] = [{ href: "/account", label: "Account", icon: AccountIcon, matchPrefix: "/account" }];

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pickemMenuOpen, setPickemMenuOpen] = useState(false);

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
                {MOBILE_STANDALONE_ITEMS.map((item) => (
                  <MobileNavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
                ))}
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

          <Link
            href="/account"
            className="hidden lg:flex items-center gap-2 absolute right-6 text-sm text-white/70 hover:text-white transition-colors"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <AccountIcon className="h-5 w-5" />
            Account
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
