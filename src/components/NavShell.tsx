"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const COLLAPSE_KEY = "pickem:nav-collapsed";

type NavItem = { href: string; label: string; icon: (props: { className?: string }) => React.JSX.Element };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Pick’em", icon: PicksIcon },
  { href: "/predictor", label: "Predictor", icon: PredictorIcon },
  { href: "/account", label: "Account", icon: AccountIcon },
];

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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function NavLink({ item, collapsed, onClick }: { item: NavItem; collapsed?: boolean; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
        active ? "bg-white/10 text-white" : "text-white/55 hover:text-white hover:bg-white/5"
      } ${collapsed ? "justify-center" : ""}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${active ? "text-[#4ade80]" : ""}`} />
      {!collapsed && <span className="text-sm">{item.label}</span>}
    </Link>
  );
}

export function NavShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed, loaded]);

  return (
    <div className="flex min-h-full">
      <aside
        className={`hidden lg:flex relative flex-col shrink-0 border-r border-white/10 bg-[#0b1730] transition-[width] duration-200 ${
          collapsed ? "w-20" : "w-60"
        }`}
      >
        <div className={`flex items-center h-16 px-4 ${collapsed ? "justify-center" : ""}`}>
          <img src="/press-logo.png" alt="Sideline Brew" className="h-12 w-auto" />
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} />
          ))}
        </nav>

        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed((c) => !c)}
          className="absolute top-1/2 -right-3.5 -translate-y-1/2 h-8 w-8 rounded-full border border-white/15 bg-[#0b1730] text-white/60 hover:text-white hover:border-white/30 flex items-center justify-center shadow-lg shadow-black/30 z-10"
        >
          <ChevronIcon className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
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
            <nav className="flex flex-col gap-1 px-3">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.href} item={item} onClick={() => setMobileOpen(false)} />
              ))}
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
          <img src="/header-logo.png" alt="Sideline Brew" className="h-16 w-auto" />
        </div>
        {children}
      </div>
    </div>
  );
}
