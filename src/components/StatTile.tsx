// One primary-KPI tile - shared by the player profile popup and the
// standalone public profile page so they can't visually drift apart.
export function StatTile({ icon, value, label, accentColor }: { icon: string; value: string; label: string; accentColor: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#1b2947] px-3 py-3 text-center">
      <span className="text-base leading-none">{icon}</span>
      <div className="text-lg leading-none tabular-nums mt-1.5" style={{ fontFamily: "var(--font-display)", color: accentColor }}>
        {value}
      </div>
      <div className="text-[8px] text-white/45 tracking-wide mt-1 leading-tight">{label}</div>
    </div>
  );
}

// A quieter secondary-stat row, for the "more stats" section beneath the
// primary KPI grid.
export function StatDetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-[#16233f] px-3 py-2.5">
      <span className="text-base w-5 text-center shrink-0">{icon}</span>
      <span className="flex-1 min-w-0 text-xs text-white/55">{label}</span>
      <span className="text-sm tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </span>
    </div>
  );
}
