import Link from "next/link";

// One primary-KPI tile - shared by the player profile popup and the
// standalone public profile page so they can't visually drift apart.
// href/onClick are opt-in per call site: public profiles leave both
// unset (nothing to navigate to on someone else's data), your own
// account page wires them to the real page/modal behind the stat.
export function StatTile({
  icon,
  value,
  label,
  accentColor,
  href,
  onClick,
}: {
  icon: string;
  value: string;
  label: string;
  accentColor: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-base leading-none">{icon}</span>
      <div className="text-lg leading-none tabular-nums mt-1.5" style={{ fontFamily: "var(--font-display)", color: accentColor }}>
        {value}
      </div>
      <div className="text-[8px] text-white/45 tracking-wide mt-1 leading-tight">{label}</div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="block rounded-2xl border border-white/10 bg-[#1b2947] px-3 py-3 text-center hover:border-white/25 hover:bg-[#212f52] active:scale-95 transition">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full rounded-2xl border border-white/10 bg-[#1b2947] px-3 py-3 text-center hover:border-white/25 hover:bg-[#212f52] active:scale-95 transition"
      >
        {content}
      </button>
    );
  }
  return <div className="rounded-2xl border border-white/10 bg-[#1b2947] px-3 py-3 text-center">{content}</div>;
}

// A quieter secondary-stat row, for the "more stats" section beneath the
// primary KPI grid. Same href/onClick opt-in as StatTile above - a
// trailing chevron appears only when the row actually goes somewhere.
export function StatDetailRow({
  icon,
  label,
  value,
  href,
  onClick,
}: {
  icon: string;
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
}) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 text-xs text-white/55">{label}</span>
      <span className="text-sm tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </span>
      {interactive && (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-white/30 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="flex items-center gap-2.5 rounded-xl bg-[#16233f] px-3 py-2.5 hover:bg-[#1b2947] transition-colors">
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="w-full flex items-center gap-2.5 rounded-xl bg-[#16233f] px-3 py-2.5 text-left hover:bg-[#1b2947] transition-colors">
        {content}
      </button>
    );
  }
  return <div className="flex items-center gap-2.5 rounded-xl bg-[#16233f] px-3 py-2.5">{content}</div>;
}
