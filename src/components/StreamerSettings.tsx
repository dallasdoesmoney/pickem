"use client";

import { createPortal } from "react-dom";
import { BoardView, ColumnChoice, ZOOM_MAX, ZOOM_MIN } from "@/hooks/useBoardView";
import { useAnchoredMenu } from "@/hooks/useAnchoredMenu";

const PANEL_WIDTH = 268;

// Streamer mode, and the layout controls that belong to it.
//
// The header control IS the switch. It used to be a button that opened a
// panel whose first item was a switch, which made flipping one setting
// two clicks and two mental steps - and left the mode looking like a
// menu of options rather than the one decision it is.
//
// The settings hang off it: a caret appears once the mode is on, and the
// panel opens itself the first time so nobody has to discover it. They
// stay a popover rather than a strip on the page, because the whole
// point of the mode is recovering vertical space on a capture window and
// a permanently visible toolbar would spend some of what it saves.
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
  // Anchored on the whole pill, not on the caret: the panel should line
  // up under the control as a unit, and a pointerdown on either half has
  // to count as inside the trigger or turning the mode off from an open
  // panel would race with the outside-click close.
  const { buttonRef, panelRef, coords } = useAnchoredMenu<HTMLSpanElement>(open, onOpenChange, PANEL_WIDTH);
  const zoomPct = Math.round(view.zoom * 100);
  // Measured against what streamer mode starts from, since that is what
  // RESET returns to - the record pill starts off in this mode.
  const isDefault = view.columns === 2 && view.zoom === 1 && view.showTabs && !view.compact && !view.showRecordPill;
  const on = view.streamerMode;

  // Desktop only for now: the mode is for someone with a capture window
  // and a guest beside them, and every control in it spends horizontal
  // room a phone does not have.
  if (!view.streamerAvailable) return null;

  // Turning it on opens the settings once, so they are found rather than
  // hunted for; turning it off takes them away, since there is nothing
  // left to set. After that the caret is the only thing that moves them.
  function toggleMode() {
    const next = !on;
    view.setStreamerMode(next);
    onOpenChange(next);
  }

  return (
    <span className="relative">
      {/* Two buttons that read as one pill. Nested buttons are invalid,
          and the switch and the caret are genuinely different actions -
          mid-stream, closing the settings and killing the guest's board
          are not the same accident. */}
      <span
        ref={buttonRef}
        className={`inline-flex items-center rounded-full border transition-colors ${
          on
            ? "border-[#ef4444]/70 bg-[#1b0d12] text-[#fca5a5]"
            : isDefault
              ? "border-white/15 text-white/60"
              : "border-white/45 bg-white/10 text-white"
        }`}
      >
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Streamer mode"
          onClick={toggleMode}
          className={`flex items-center gap-2 rounded-full py-1.5 pl-2 pr-2.5 text-[11px] transition-colors ${
            on ? "" : "hover:text-white"
          }`}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {/* On air, at a glance. The pill is the only thing on screen
              that says a guest board is live, and it is easy to leave on. */}
          {on && (
            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#ef4444] motion-reduce:animate-none" />
          )}
          <span
            className={`flex h-[17px] w-[30px] shrink-0 items-center rounded-full p-0.5 transition-colors ${
              on ? "bg-[#ef4444]" : "bg-white/15"
            }`}
          >
            <span
              className={`h-[13px] w-[13px] rounded-full bg-white transition-transform motion-reduce:transition-none ${
                on ? "translate-x-[13px]" : ""
              }`}
            />
          </span>
          STREAMER MODE
        </button>

        {on && (
          <button
            type="button"
            aria-label="Board layout"
            aria-expanded={open}
            onClick={() => onOpenChange(!open)}
            className="mr-1 flex items-center border-l border-white/20 py-1.5 pl-2 pr-1.5 transition-opacity hover:opacity-100 opacity-80"
          >
            <svg
              viewBox="0 0 24 24"
              className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      </span>

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
            {/* No switch in here any more - the control you opened this
                from is the switch, and a second one that did the same
                thing read as a different setting. What is left is a
                reminder of what the mode is doing, since the board went
                blank the moment it came on and that wants explaining
                once. */}
            <p className="mb-3 border-b border-white/10 pb-2.5 text-[11px] leading-snug text-white/45">
              Blank board for a guest. Nothing here is saved, and your own picks are untouched.
            </p>

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
                {/* Stated as the thing you keep rather than the thing
                    you lose: every other switch here is on when its
                    element is showing, and "Compact pills" was the one
                    that ran backwards. Same setting underneath. */}
                <Toggle
                  label="Spread & record"
                  hint="The odds line on each half — a third of every pill's height"
                  on={!view.compact}
                  onChange={(next) => view.setCompact(!next)}
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
