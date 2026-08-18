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

// The Aurora Glass hub card - blurred mesh blobs behind frosted glass, a
// floating icon badge. Deliberately just an icon, a live/count tag, a
// name, and a one-line subtitle - no avatar, stats, or standings preview.
// Earlier versions packed the destination's own content into the card
// (your record, a leaderboard slice, a team marquee) and it read as
// "you're already looking at the page" instead of a choice between two
// modes; that detail already lives on /weekly and /account. No grain
// texture - the rest of the app is flat, and this should match it.
function HubCard({
  href,
  base,
  blob1,
  blob2,
  glassTint,
  icon,
  tag,
  tagColor,
  title,
  subtitle,
}: {
  href: string;
  base: string;
  blob1: string;
  blob2: string;
  glassTint: string;
  icon: React.ReactNode;
  tag: string;
  tagColor: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-[22px] border border-white/20 p-[18px] transition-all duration-300 ease-out hover:-translate-y-1 hover:border-white/35 hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.55)] active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      style={{ minHeight: 150, background: base }}
    >
      <span
        className="absolute -left-[50px] -top-[70px] h-[200px] w-[200px] rounded-full opacity-60 transition-[transform,opacity] duration-500 ease-out group-hover:scale-110 group-hover:opacity-85 motion-reduce:transition-none"
        style={{ background: blob1, filter: "blur(46px)" }}
      />
      <span
        className="absolute -bottom-[80px] -right-[60px] h-[200px] w-[200px] rounded-full opacity-40 transition-[transform,opacity] duration-500 ease-out group-hover:scale-110 group-hover:opacity-60 motion-reduce:transition-none"
        style={{ background: blob2, filter: "blur(46px)" }}
      />
      <span className="absolute inset-0" style={{ background: glassTint, backdropFilter: "blur(28px)" }} />
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-center justify-between">
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none"
            style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", boxShadow: "0 8px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.1)" }}
          >
            {icon}
          </span>
          <span className="flex items-center gap-1.5 text-[10px] tracking-wide" style={{ color: "rgba(244,246,251,0.65)" }}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColor, boxShadow: `0 0 8px ${tagColor}` }} />
            {tag}
          </span>
        </div>
        <div>
          <div className="text-[21px]" style={{ fontFamily: "var(--font-display)", color: "#f4f6fb" }}>
            {title}
          </div>
          <div className="mt-1 text-[12px] leading-snug" style={{ color: "rgba(244,246,251,0.65)" }}>
            {subtitle}
          </div>
        </div>
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
        base="#0e2818"
        blob1="#4ade80"
        blob2="#22c55e"
        glassTint="rgba(14,40,24,0.3)"
        icon={<WeeklyIcon className="h-5 w-5" style={{ color: "#fff" }} />}
        tag="Live"
        tagColor="#4ade80"
        title="Weekly Pick&rsquo;em"
        subtitle={`Pick a winner in every Week ${activeWeek} game and climb the leaderboard.`}
      />

      <HubCard
        href="/predictor"
        base="#0b2a3d"
        blob1="#38bdf8"
        blob2="#c084fc"
        glassTint="rgba(11,42,61,0.3)"
        icon={<TeamIcon className="h-5 w-5" style={{ color: "#fff" }} />}
        tag="32 teams"
        tagColor="#38bdf8"
        title="Team Pick&rsquo;em"
        subtitle="Lock in one team for the season and track their record all year."
      />
    </main>
  );
}
