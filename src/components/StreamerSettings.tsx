"use client";

import { createPortal } from "react-dom";
import { BoardView, ColumnChoice, ZOOM_MAX, ZOOM_MIN } from "@/hooks/useBoardView";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 268;

// Layout controls for a board. A popover rather than a strip of
// controls on the page, because the entire point of this menu is
// recovering vertical space - a permanently visible toolbar would spend
// some of what it is meant to save.
export function StreamerSettings({
  view,
  open,
  onOpenChange,
  // Weekly has kickoff tabs and a spread/record line to drop; the
  // predictor's footer is the week number and cannot go.
  showWeeklyToggles = false,
}: {
  view: BoardView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showWeeklyToggles?: boolean;
}) {
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLButtonElement>(open, onOpenChange, PANEL_WIDTH);
  const zoomPct = Math.round(view.zoom * 100);
  const isDefault =
    view.columns === 2 && view.zoom === 1 && view.showTabs && !view.compact && view.showRecordPill;

  return (
    <span className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Streamer settings"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] transition-colors ${
          isDefault
            ? "border-white/15 text-white/60 hover:border-white/35 hover:text-white"
            : "border-white/45 bg-white/10 text-white"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="7" height="16" rx="1.5" />
          <rect x="14" y="4" width="7" height="16" rx="1.5" />
        </svg>
        {/* The percentage stands in for the label once it is not 100 -
            so a board left zoomed says so without opening anything. */}
        <span className="hidden sm:inline">{zoomPct === 100 ? "STREAMER" : `${zoomPct}%`}</span>
      </button>

      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Streamer settings"
            style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="fixed z-[100] rounded-2xl border border-white/10 bg-[#101d38] p-3 shadow-2xl shadow-black/60"
          >
            <Section label="Columns">
              <div className="flex gap-1.5">
                {(["auto", 2, 3, 4] as ColumnChoice[]).map((c) => (
                  <Chip
                    key={String(c)}
                    active={view.columns === c}
                    onClick={() => view.setColumns(c)}
                    label={c === "auto" ? "AUTO" : String(c)}
                  />
                ))}
              </div>
              {/* More columns is the only lever that buys height without
                  making anything smaller, so it is worth saying what it
                  is doing. */}
              <p className="mt-1.5 text-[11px] leading-snug text-white/40">
                {view.columnsLockedByWidth
                  ? "Two columns on a narrow screen, whatever is set here."
                  : `Showing ${view.cols}. More columns means fewer rows, at the same pill size.`}
              </p>
            </Section>

            <Section label={`Zoom · ${zoomPct}%`}>
              <input
                type="range"
                min={ZOOM_MIN * 100}
                max={ZOOM_MAX * 100}
                step={5}
                value={zoomPct}
                onChange={(e) => view.setZoom(Number(e.target.value) / 100)}
                aria-label="Zoom"
                className="w-full accent-emerald-400"
              />
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={view.fitToScreen}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-400/10 py-1.5 text-[11px] text-emerald-300 transition-colors hover:bg-emerald-400/20"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6" />
                  </svg>
                  FIT TO SCREEN
                </button>
                <button
                  type="button"
                  onClick={() => view.setZoom(1)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-[11px] text-white/60 transition-colors hover:border-white/35 hover:text-white"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  100%
                </button>
              </div>
            </Section>

            {showWeeklyToggles && (
              <Section label="Trim">
                <Toggle
                  label="Your record pill"
                  hint="Your own record and rank, above the board"
                  on={view.showRecordPill}
                  onChange={view.setShowRecordPill}
                />
                <Toggle
                  label="Kickoff tabs"
                  hint="The day and time above each matchup"
                  on={view.showTabs}
                  onChange={view.setShowTabs}
                />
                <Toggle
                  label="Compact pills"
                  hint="Drops the spread line — a third of each pill's height"
                  on={view.compact}
                  onChange={view.setCompact}
                />
              </Section>
            )}

            {!isDefault && (
              <button
                type="button"
                onClick={view.reset}
                className="mt-1 w-full rounded-lg py-1.5 text-[11px] text-white/45 transition-colors hover:text-white"
                style={{ fontFamily: "var(--font-display)" }}
              >
                RESET TO DEFAULTS
              </button>
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-[10px] tracking-[0.16em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
        {label.toUpperCase()}
      </div>
      {children}
    </div>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 rounded-lg border py-1.5 text-[11px] transition-colors ${
        active ? "border-white/45 bg-white/10 text-white" : "border-white/15 text-white/55 hover:border-white/35 hover:text-white"
      }`}
      style={{ fontFamily: "var(--font-display)" }}
    >
      {label}
    </button>
  );
}

function Toggle({
  label,
  hint,
  on,
  onChange,
}: {
  label: string;
  hint: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="mb-1.5 flex w-full items-start gap-2.5 rounded-lg px-1 py-1 text-left transition-colors last:mb-0 hover:bg-white/5"
    >
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
          on ? "bg-emerald-400/80" : "bg-white/15"
        }`}
      >
        <span className={`h-3 w-3 rounded-full bg-white transition-transform ${on ? "translate-x-3" : ""}`} />
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] text-white/85">{label}</span>
        <span className="block text-[11px] leading-snug text-white/40">{hint}</span>
      </span>
    </button>
  );
}
