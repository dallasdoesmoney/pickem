import Link from "next/link";

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

// Data-driven so a third/fourth mode (or a Leaderboard card, etc.) is a
// one-line addition later rather than a restructure.
const OPTIONS = [
  {
    href: "/weekly",
    label: "Weekly Pick’em",
    description: "Pick every game against the spread, week by week.",
    icon: PicksIcon,
    accent: "#4ade80",
  },
  {
    href: "/predictor",
    label: "Team Pick’em",
    description: "Predict a team’s full season, game by game.",
    icon: PredictorIcon,
    accent: "#60a5fa",
  },
];

export default function HomePage() {
  return (
    <main className="flex-1 px-4 pb-16 pt-14 max-w-3xl w-full mx-auto flex flex-col items-center">
      <div className="text-center mb-12">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">SIDELINE BREW</div>
        <h1 className="text-[clamp(2.2rem,9vw,3.5rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          CHOOSE YOUR PICK&rsquo;EM
        </h1>
        <p className="text-white/50 text-sm mt-3">Pick how you want to play.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 w-full">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <Link
              key={opt.href}
              href={opt.href}
              className="group flex flex-col items-center text-center gap-4 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-colors px-6 py-10"
            >
              <span
                className="h-16 w-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ background: `${opt.accent}22`, border: `1px solid ${opt.accent}55`, color: opt.accent }}
              >
                <Icon className="h-8 w-8" />
              </span>
              <div>
                <div className="text-xl" style={{ fontFamily: "var(--font-display)" }}>
                  {opt.label}
                </div>
                <p className="text-white/50 text-sm mt-1.5">{opt.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
