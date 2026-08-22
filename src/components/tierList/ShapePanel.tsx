"use client";

import {
  Direction,
  MAX_PER_ROW,
  MAX_PYRAMID_ROWS,
  MIN_PYRAMID_ROWS,
  STEP_CHOICES,
  canGo,
  capsFrom,
  directionsOf,
  stepOf,
} from "./pyramid";

// Setting the pyramid's shape, a row at a time.
//
// A row is not a number you type. It holds MORE than the row above it,
// the SAME, or FEWER - and that is the whole vocabulary, because those
// three are the only things an edge can do. Out and in are the step's
// angle mirrored; the same is a width change of nothing, which is a
// vertical edge. Counts are derived from the top row and those choices,
// so a half-step - which would be a fourth angle - cannot be expressed.
//
// Off the board rather than on it. Controls used to sit beside each row
// in the space the slopes left over, which worked while the shape only
// ever widened; the moment a row can be narrower than the one above, the
// teams run right up to both slopes and there is nowhere in a row that is
// reliably empty.

const DIRECTIONS: { d: Direction; label: string }[] = [
  { d: 1, label: "OUT" },
  { d: 0, label: "DOWN" },
  { d: -1, label: "IN" },
];

export function ShapePanel({
  caps,
  bands,
  onChange,
}: {
  caps: number[];
  bands: { label: string; accent: string }[];
  onChange: (caps: number[]) => void;
}) {
  const step = stepOf(caps);
  const dirs = directionsOf(caps);

  const setDir = (row: number, d: Direction) => {
    const next = [...dirs];
    next[row] = d;
    onChange(capsFrom(caps[0], next, step));
  };
  const setSeed = (n: number) => onChange(capsFrom(n, dirs, step));
  const setStep = (k: number) => onChange(capsFrom(caps[0], dirs, k));
  const addRow = () => onChange(capsFrom(caps[0], [...dirs, dirs[dirs.length - 1]], step));
  const dropRow = (row: number) =>
    onChange(capsFrom(row === 0 ? caps[1] : caps[0], dirs.filter((_, i) => i !== row), step));

  return (
    <section className="mt-4 rounded-2xl border border-white/12 bg-[#0b1730] p-3.5">
      <div className="flex items-baseline justify-between mb-2.5">
        <h2 className="text-[10px] tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
          PYRAMID SHAPE
        </h2>
        <span className="text-[11px] text-white/40 tabular-nums">
          {caps.length} rows · {caps.reduce((a, b) => a + b, 0)} places
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {caps.map((cap, row) => (
          <div
            key={row}
            className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0a1526] py-1.5 pl-2.5 pr-1.5"
          >
            <span
              aria-hidden
              className="h-[22px] w-[8px] shrink-0 rounded-sm"
              style={{ background: bands[row]?.accent ?? "#94a3b8" }}
            />
            <span
              className="shrink-0 min-w-[26px] truncate text-[11px] text-white/80"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {bands[row]?.label || row + 1}
            </span>
            <span className="shrink-0 min-w-[17px] text-center text-[12.5px] font-semibold tabular-nums text-white">
              {cap}
            </span>

            {row === 0 ? (
              <>
                <span className="ml-auto shrink-0 text-[10px] tracking-wide text-white/35">TOP ROW</span>
                <span className="flex shrink-0 items-center rounded-full border border-white/12 bg-[#08111f] p-px">
                  <button
                    type="button"
                    aria-label="One fewer in the top row"
                    disabled={cap <= 1}
                    onClick={() => setSeed(cap - 1)}
                    className="h-[26px] w-[26px] rounded-full text-[15px] leading-none text-white/70 disabled:opacity-25 enabled:hover:text-white"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label="One more in the top row"
                    disabled={cap >= MAX_PER_ROW}
                    onClick={() => setSeed(cap + 1)}
                    className="h-[26px] w-[26px] rounded-full text-[15px] leading-none text-white/70 disabled:opacity-25 enabled:hover:text-white"
                  >
                    +
                  </button>
                </span>
              </>
            ) : (
              <span
                role="group"
                aria-label={`Which way row ${bands[row]?.label || row + 1} goes`}
                className="flex min-w-0 flex-1 overflow-hidden rounded-full border border-white/12 bg-[#08111f]"
              >
                {DIRECTIONS.map(({ d, label }) => {
                  const on = dirs[row] === d;
                  const room = canGo(caps[row - 1], d, step);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      // A direction with no room greys out rather than
                      // being skipped, so the limit is visible instead of
                      // something you find by tapping past it.
                      disabled={!room}
                      onClick={() => setDir(row, d)}
                      className={`min-w-0 flex-1 whitespace-nowrap px-1 py-[7px] text-[9px] tracking-wide transition-colors disabled:opacity-30 ${
                        on ? ON_CLASS[d] : "text-white/40 enabled:hover:text-white/80"
                      }`}
                      style={{ fontFamily: "var(--font-display)" }}
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
            )}

            <button
              type="button"
              aria-label={`Remove row ${bands[row]?.label || row + 1}`}
              disabled={caps.length <= MIN_PYRAMID_ROWS}
              onClick={() => dropRow(row)}
              className="shrink-0 px-1 text-[17px] leading-none text-white/30 disabled:opacity-25 enabled:hover:text-red-400"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={caps.length >= MAX_PYRAMID_ROWS}
        className="mt-2 w-full rounded-xl border border-dashed border-white/20 py-2.5 text-[10px] tracking-[0.1em] text-white/50 transition-colors disabled:opacity-35 enabled:hover:border-emerald-400/60 enabled:hover:text-emerald-300"
        style={{ fontFamily: "var(--font-display)" }}
      >
        + ADD ROW
      </button>

      <p className="mt-4 mb-2 text-[10px] tracking-[0.14em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
        TEAMS PER STEP
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {STEP_CHOICES.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={step === k}
            onClick={() => setStep(k)}
            className={`rounded-xl border py-2 text-[11px] transition-colors ${
              step === k
                ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                : "border-white/10 bg-[#0a1526] text-white/50 hover:border-white/30 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            ±{k}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-white/35">
        How much a row gains or loses. It sets the angle of the sides — wider steps
        lean them over further, and cost logo size.
      </p>
    </section>
  );
}

// The colour a chosen direction takes: the accent for wider, plain white
// for a vertical edge, the top tier's pink for narrower. Three states
// need three looks, or the pill only says "something is selected".
const ON_CLASS: Record<Direction, string> = {
  1: "bg-emerald-400/[0.16] text-emerald-300",
  0: "bg-white/[0.14] text-white",
  [-1]: "bg-pink-400/[0.16] text-pink-300",
};
