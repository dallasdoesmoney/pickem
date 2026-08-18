"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchWeeks, WeekRow } from "@/lib/supabase/admin";
import { CURRENT_WEEK } from "@/data/games";

function WeeklyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="8" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
      <rect x="13" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function TeamIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18" />
      <path d="M8 3v3" />
      <path d="M16 3v3" />
      <path d="M8 14l2.5 2.5L16 11" />
    </svg>
  );
}

// Neutral panel matching the rest of the app - color is kept to small
// accents (an icon, a dot, a count badge) rather than a tinted surface.
// The earlier gradient/glass hub cards were the only colored-background
// surfaces in the whole app, which is exactly why they read as off. Uses
// the same solid #101f3d/#152546 panel as leaderboard rows, not the
// thinner bg-white/5 wash from admin's menu - these are the primary
// choice on the page and need to read clearly, not blend into the navy.
function HubCard({
  href,
  iconBg,
  iconBorder,
  icon,
  tag,
  tagColor,
  title,
  subtitle,
}: {
  href: string;
  iconBg: string;
  iconBorder: string;
  icon: React.ReactNode;
  tag: string;
  tagColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-[#101f3d] p-[18px] transition-all duration-300 ease-out hover:-translate-y-1 hover:bg-[#152546] hover:border-white/20 hover:shadow-[0_18px_40px_-14px_rgba(0,0,0,0.5)] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ minHeight: 150 }}
    >
      <div className="flex items-center justify-between">
        <span
          className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none"
          style={{ background: iconBg, border: `1px solid ${iconBorder}` }}
        >
          {icon}
        </span>
        <span className="flex items-center gap-1.5 text-[10px] tracking-wide text-white/45">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor }} />
          {tag}
        </span>
      </div>
      <div>
        <div className="text-[21px] text-white" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </div>
        <div className="mt-1 text-[12px] leading-snug text-white/45">{subtitle}</div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const [weeks, setWeeks] = useState<WeekRow[]>([]);

  useEffect(() => {
    fetchWeeks()
      .then(setWeeks)
      .catch(() => {});
  }, []);

  const activeWeek = useMemo(() => {
    const openWeeks = weeks.filter((w) => w.is_open).map((w) => w.week);
    return openWeeks.length > 0 ? Math.max(...openWeeks) : CURRENT_WEEK;
  }, [weeks]);

  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-lg w-full mx-auto flex flex-col gap-6">
      <div className="text-center">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW</div>
        <h1 className="text-[clamp(2rem,8vw,2.75rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK&rsquo;EM
        </h1>
      </div>

      <HubCard
        href="/weekly"
        iconBg="rgba(74,222,128,0.14)"
        iconBorder="rgba(74,222,128,0.25)"
        icon={<WeeklyIcon className="h-5 w-5" style={{ color: "#4ade80" }} />}
        tag="Live"
        tagColor="#4ade80"
        title="Weekly Pick&rsquo;em"
        subtitle={`Pick a winner in every Week ${activeWeek} game and climb the leaderboard.`}
      />

      <HubCard
        href="/predictor"
        iconBg="rgba(56,189,248,0.14)"
        iconBorder="rgba(56,189,248,0.25)"
        icon={<TeamIcon className="h-5 w-5" style={{ color: "#38bdf8" }} />}
        tag="32 teams"
        tagColor="#38bdf8"
        title="Team Pick&rsquo;em"
        subtitle="Lock in one team for the season and track their record all year."
      />
    </main>
  );
}
