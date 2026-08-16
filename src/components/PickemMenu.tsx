"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 220;

const ITEMS = [
  { href: "/weekly", label: "Weekly Pick’em", matchPrefix: "/weekly", exact: false },
  { href: "/predictor", label: "Team Pick’em", matchPrefix: "/predictor", exact: false },
  { href: "/leaderboard", label: "Leaderboard", matchPrefix: "/leaderboard", exact: false },
];

export function PickemMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const pathname = usePathname();
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const isActive = pathname.startsWith("/weekly") || pathname.startsWith("/predictor") || pathname.startsWith("/leaderboard");

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Pick'em menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm transition-colors ${
          isActive ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        Pick&rsquo;em
        <svg
          viewBox="0 0 24 24"
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="menu"
            style={{ top: coords.top, left: coords.left, width: Math.min(PANEL_WIDTH, typeof window !== "undefined" ? window.innerWidth - 24 : PANEL_WIDTH) }}
            className="fixed z-[100] rounded-2xl border border-white/10 bg-[#101d38] shadow-2xl shadow-black/60 p-2"
          >
            {ITEMS.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.matchPrefix);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => onOpenChange(false)}
                  className={`flex items-center rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active ? "bg-white/10 text-white" : "text-white/70 hover:text-white hover:bg-white/5"
                  }`}
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
