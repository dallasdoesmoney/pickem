import Link from "next/link";

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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

// Data-driven so a third mode is a one-line addition later rather than a
// restructure. This page's only job is routing to one of the two modes -
// no profile/stats/leaderboard here, that all lives on their own pages now.
const OPTIONS = [
  {
    href: "/weekly",
    label: "Weekly Pick’em",
    description: "Pick every game against the spread, week by week.",
    icon: WeeklyIcon,
    accent: "#4ade80",
  },
  {
    href: "/predictor",
    label: "Team Pick’em",
    description: "Predict a team’s full 2026 season, game by game.",
    icon: TeamIcon,
    accent: "#38bdf8",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 px-4 pb-16 pt-14 max-w-lg w-full mx-auto flex flex-col items-center">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW</div>
        <h1 className="text-[clamp(2.2rem,9vw,3.5rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK&rsquo;EM
        </h1>
      </div>

      <div className="flex flex-col gap-4 w-full">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex items-center gap-4 rounded-3xl px-5 py-6 bg-[#1b2947] hover:bg-[#212f52] transition-colors active:scale-[0.98]"
            >
              <span className="h-[54px] w-[54px] shrink-0 rounded-2xl flex items-center justify-center" style={{ background: `${opt.accent}26` }}>
                <Icon className="h-6 w-6" style={{ color: opt.accent }} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-lg" style={{ fontFamily: "var(--font-display)" }}>
                  {opt.label}
                </div>
                <p className="text-white/55 text-xs mt-1">{opt.description}</p>
              </div>
              <ChevronIcon className="h-5 w-5 text-white/40 shrink-0 group-hover:text-white/60 transition-colors" />
            </Link>
          );
        })}
      </div>
    </main>
  );
}
