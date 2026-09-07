"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { DIAL_MAX, DIAL_MIN, BAND_2, BAND_3, BAND_4 } from "@/lib/wavelength/engine";
import { INK, MONEY, outlined } from "@/components/versus/style";

// THE DIAL. One component, drawn at whatever size it is handed, and it is
// the only thing on either screen that knows the game is a half-circle.
//
// It is also the whole interface now. The guess is made by dragging the
// needle on this face and the target is uncovered on this face, because
// the point of the graphic is that a room watching a stream sees both
// things happen in the same place - a slider under the picture and a
// second little dial off to one side are two people describing a game
// nobody is actually watching.
//
// SVG rather than rotated boxes, because the target is a WEDGE and the
// needle has to point at a number: an arc and a line are one path each in
// SVG and a pile of transforms in CSS. It also means the graphic scales
// to the 1080-wide OBS stage and down to a phone from the same source.
//
// THREE LAYERS, and the middle one is the whole trick:
//
//   the SLOT   a dark recess with the scoring wedge in it, always drawn
//              when there is a target to draw, and normally hidden
//   the COVER  a cream half-disc sitting over the slot. It is a 180-degree
//              SECTOR clipped to the top half, so opening it is a single
//              rotate() - swing it round and it is simply in the bottom
//              half, where the clip cuts it away. That is what makes the
//              reveal a shutter sweeping across the face rather than a
//              wedge popping into existence.
//   the FACE   the rim, the needle, the hub and the two end words, which
//              are on the outside of the case and never move with the lid

// THE RECESS IS THE CREAM ONE. What is under the lid is the surface the
// scoring wedge is printed on, so it is the pale board colour; the lid on
// top of it is the light blue.
const SLOT = "#f6ecd6";
export const LID = "#7cc6f7";

// ONE POINTER, ONE COLOUR. It used to be whichever team was psychic,
// which meant the single most important object on the graphic changed
// colour every round and matched a team label while doing it. A dial has
// a needle; the needle is red-orange, on the blue lid and on the cream
// recess alike, and the graphic says whose turn it is in words.
const NEEDLE = "#ff5a24";

// THE SCORING BANDS, and they are three different colours because "how
// close was that" is the one question the whole graphic exists to answer -
// three shades of one green made a viewer count rings to find out.
//
// Dark to bright as they get closer, which is what makes it readable at a
// glance and over a compressed stream: hue alone smears, luminance does
// not. Only the outer band ever touches the cream, so that is the one that
// has to hold up against it - 6.4:1, measured.
const BAND_FILL: Record<number, string> = {
  2: "#5b34c9",
  3: "#1c86c9",
  4: MONEY,
};

// How long the lid takes. Exported because the board holds the target on
// screen for exactly this long after the psychic lets go - otherwise the
// wedge vanishes and the lid closes over an empty recess.
export const COVER_MS = 620;

// A value on the dial as an angle. 0 is the left edge of the half-circle
// and 100 the right, so the needle sweeps 180 degrees.
function angleFor(value: number): number {
  const t = (value - DIAL_MIN) / (DIAL_MAX - DIAL_MIN);
  return -90 + t * 180;
}

// A point on the arc, in the SVG's own coordinates. The dial's origin is
// the middle of the flat bottom edge.
function pointAt(cx: number, cy: number, r: number, value: number) {
  const a = ((angleFor(value) - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

// A filled wedge between two values, from the hub out to `r`.
function wedgePath(cx: number, cy: number, r: number, from: number, to: number): string {
  const a = pointAt(cx, cy, r, Math.max(DIAL_MIN, from));
  const b = pointAt(cx, cy, r, Math.min(DIAL_MAX, to));
  // Always the short way round: no band here is anywhere near 180deg.
  return `M ${cx} ${cy} L ${a.x} ${a.y} A ${r} ${r} 0 0 1 ${b.x} ${b.y} Z`;
}

export function Dial({
  width,
  left,
  right,
  // Null hides the wedge entirely - which is most of the game, and on the
  // overlay it is not a decision the graphic makes: the number is not in
  // the message it was given.
  target,
  guess,
  // Is the lid up. The reveal, and the psychic's peek, are the same
  // motion on the same face.
  open = false,
  // Flash the band that just scored.
  pulse = false,
  // Handed in only by the board. Without it the dial is a picture.
  onScrub,
}: {
  width: number;
  left: string;
  right: string;
  target: number | null;
  guess: number | null;
  open?: boolean;
  pulse?: boolean;
  onScrub?: (value: number) => void;
}) {
  // Two dials can be on one page - the mirror and the rules picture on the
  // setup screen - and a duplicated clipPath id would have one of them
  // clipping to the other's shape.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const r = width / 2;
  const cx = r;
  const cy = r;
  // The face is a half-circle, so the box is half as tall as it is wide,
  // plus room under it for the hub and the two end labels.
  const h = r + Math.round(width * 0.14);

  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // State as well as a ref, because the needle's CSS depends on it - see
  // the transition note below. It flips twice a drag, not sixty times.
  const [dragged, setDragged] = useState(false);

  // WHERE ON THE FACE WAS THAT. Measured off the element's own rectangle
  // rather than the SVG's coordinates, because on the control board this
  // whole graphic is a 1080-wide stage scaled down to fit a phone - the
  // viewBox says 760 and the thing under the finger is 300.
  const scrubTo = useCallback(
    (clientX: number, clientY: number) => {
      const el = box.current;
      if (!el || !onScrub) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const scale = rect.width / width;
      const hubX = rect.left + cx * scale;
      const hubY = rect.top + cy * scale;
      // Measured up from the flat edge, so 0 is due right and PI is due
      // left - the same direction the dial is numbered, backwards.
      const ang = Math.atan2(hubY - clientY, clientX - hubX);
      // Below the flat edge there is no angle to read, so it pins to
      // whichever end the finger is nearer. Dragging off the bottom of the
      // dial should park the needle at an end, not make it jump.
      const raw = ang < 0 ? (clientX >= hubX ? DIAL_MAX : DIAL_MIN) : (1 - ang / Math.PI) * 100;
      onScrub(Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round(raw * 10) / 10)));
    },
    [onScrub, width, cx, cy],
  );

  // ONE UPDATE PER FRAME, however fast the mouse is reporting.
  //
  // A pointing device is not capped at 60Hz - a gaming mouse reports at
  // 1000 - and every raw move here would be a React render of the entire
  // graphic and, on the board, a message onto the wire. Coalescing to an
  // animation frame throws away the moves nobody could have seen anyway
  // and always keeps the newest one.
  const pending = useRef<{ x: number; y: number } | null>(null);
  const frame = useRef<number | null>(null);

  const queue = useCallback(
    (x: number, y: number) => {
      pending.current = { x, y };
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const at = pending.current;
        if (at) scrubTo(at.x, at.y);
      });
    },
    [scrubTo],
  );

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  const nudge = (by: number) => {
    if (!onScrub) return;
    const from = guess ?? 50;
    onScrub(Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round((from + by) * 10) / 10)));
  };

  const BANDS: { from: number; to: number; band: number }[] =
    target === null
      ? []
      : [
          { from: target - BAND_2, to: target + BAND_2, band: 2 },
          { from: target - BAND_3, to: target + BAND_3, band: 3 },
          { from: target - BAND_4, to: target + BAND_4, band: 4 },
        ];
  // Which band the needle actually landed in, so only that one flashes.
  const hit = target !== null && guess !== null ? BANDS.filter((b) => guess >= b.from && guess <= b.to).pop() : null;

  // WHAT EACH RING IS WORTH, printed on it - 2 3 4 3 2 across the target,
  // the way the board itself is marked. Three colours say "that is a
  // different ring"; the numerals are what say how much better it was.
  const marks =
    target === null
      ? []
      : [
          { at: target - (BAND_3 + BAND_2) / 2, n: 2 },
          { at: target - (BAND_4 + BAND_3) / 2, n: 3 },
          { at: target, n: 4 },
          { at: target + (BAND_4 + BAND_3) / 2, n: 3 },
          { at: target + (BAND_3 + BAND_2) / 2, n: 2 },
          // A numeral is about a unit and a half wide on the arc and it
          // sits inside the same clip as the wedge, so one any closer to
          // an end than this gets sliced down the middle rather than
          // tidily left out. The wedge itself still runs right off the
          // edge - that is the point of letting the target go there.
        ].filter((m) => m.at >= DIAL_MIN + 2 && m.at <= DIAL_MAX - 2);

  const face = wedgePath(cx, cy, r, DIAL_MIN, DIAL_MAX);
  const inner = wedgePath(cx, cy, r * 0.985, DIAL_MIN, DIAL_MAX);
  const ticks = Array.from({ length: 11 }, (_, i) => i * 10);

  const live = Boolean(onScrub);

  return (
    <div
      ref={box}
      style={{
        width,
        height: h,
        position: "relative",
        // A drag across the face would otherwise select the two words on
        // the flat edge and leave them sitting there highlighted in blue -
        // on the overlay, in front of everybody.
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        cursor: live ? "grab" : undefined,
      }}
      // The dial is the control, so it is the control in the accessibility
      // tree too - not a decorative picture with a hidden slider beside it.
      {...(live
        ? {
            role: "slider" as const,
            tabIndex: 0,
            "aria-label": "Where the target is",
            "aria-valuemin": DIAL_MIN,
            "aria-valuemax": DIAL_MAX,
            "aria-valuenow": guess ?? 50,
            onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
              dragging.current = true;
              setDragged(true);
              e.currentTarget.setPointerCapture(e.pointerId);
              // Straight through rather than queued: a tap on the face
              // should land on the frame it happened.
              scrubTo(e.clientX, e.clientY);
            },
            onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
              if (dragging.current) queue(e.clientX, e.clientY);
            },
            onPointerUp: () => {
              dragging.current = false;
              setDragged(false);
            },
            onPointerCancel: () => {
              dragging.current = false;
              setDragged(false);
            },
            onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
              const step =
                e.key === "ArrowLeft" || e.key === "ArrowDown"
                  ? -1
                  : e.key === "ArrowRight" || e.key === "ArrowUp"
                    ? 1
                    : e.key === "PageDown"
                      ? -10
                      : e.key === "PageUp"
                        ? 10
                        : 0;
              if (step !== 0) {
                e.preventDefault();
                nudge(step);
              } else if (e.key === "Home" || e.key === "End") {
                e.preventDefault();
                onScrub?.(e.key === "Home" ? DIAL_MIN : DIAL_MAX);
              }
            },
          }
        : {})}
    >
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={{ display: "block", overflow: "visible" }}>
        <defs>
          {/* The lid is a 180-degree sector rotated into and out of this
              shape. Clipping it here is what turns a rotation into a
              shutter. */}
          <clipPath id={`wl-face-${uid}`}>
            <path d={inner} />
          </clipPath>
        </defs>

        {/* ---- the slot, and what is in it ---- */}
        <g clipPath={`url(#wl-face-${uid})`}>
          <path d={inner} fill={SLOT} />
          {/* Widest band first so the bullseye sits on top of it. */}
          {BANDS.map((b) => (
            <path
              key={b.band}
              data-wedge
              className={pulse && hit?.band === b.band ? "wl-band wl-pulse" : "wl-band"}
              d={wedgePath(cx, cy, r * 0.97, b.from, b.to)}
              fill={BAND_FILL[b.band]}
            />
          ))}
          {/* The numerals, in the graphic's own lettering - white with an
              ink outline, which is the one treatment that holds on all
              three band colours without a rule per colour. */}
          {marks.map((m, i) => {
            // Up near the rim, where the slot is at its widest and where
            // the eye already is - and TURNED WITH THE ARC, so the five of
            // them read as printing on a dial rather than five numbers
            // dropped on top of one.
            const at = pointAt(cx, cy, r * 0.87, m.at);
            const size = Math.round(width * 0.036);
            return (
              <text
                key={`${m.n}-${i}`}
                x={at.x}
                y={at.y + size * 0.36}
                textAnchor="middle"
                transform={`rotate(${angleFor(m.at)} ${at.x} ${at.y})`}
                style={{ ...outlined(size), fill: "#ffffff", fontFamily: "var(--font-display)", fontSize: size }}
              >
                {m.n}
              </text>
            );
          })}
          {/* Faint ticks down in the recess, so the wedge can still be
              read against a number once the lid is up. */}
          {ticks.map((v) => {
            const outer = pointAt(cx, cy, r * 0.96, v);
            const stop = pointAt(cx, cy, r * (v === 50 ? 0.86 : 0.91), v);
            return (
              <line
                key={v}
                x1={stop.x}
                y1={stop.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(5,7,13,0.18)"
                strokeWidth={Math.max(2, width * (v === 50 ? 0.007 : 0.004))}
              />
            );
          })}

          {/* ---- the lid ---- */}
          <g
            className={open ? "wl-cover wl-open" : "wl-cover"}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {/* OUTLINED, so the sweeping edge is a hard line rather than
                a colour boundary - travelling is the whole trick. */}
            <path
              d={inner}
              fill={LID}
              stroke={INK}
              strokeWidth={Math.max(3, width * 0.009)}
              strokeLinejoin="round"
            />
            {ticks.map((v) => {
              const outer = pointAt(cx, cy, r * 0.96, v);
              const stop = pointAt(cx, cy, r * (v === 50 ? 0.84 : 0.9), v);
              return (
                <line
                  key={v}
                  x1={stop.x}
                  y1={stop.y}
                  x2={outer.x}
                  y2={outer.y}
                  stroke={v === 50 ? "rgba(5,7,13,0.45)" : "rgba(5,7,13,0.24)"}
                  strokeWidth={Math.max(2, width * (v === 50 ? 0.008 : 0.004))}
                />
              );
            })}
          </g>
        </g>

        {/* ---- the case, over everything ---- */}
        <path d={face} fill="none" stroke={INK} strokeWidth={Math.max(4, width * 0.014)} />

        {/* THE NEEDLE, drawn straight up and rotated into place, so moving
            it is one animatable transform rather than a redrawn line. The
            ink under-stroke is what carries it: red-orange on light blue
            is 1.7:1, which is nothing - the black edge either side of it
            is what you actually see, on the lid, on the cream and over a
            camera alike. */}
        {/* ALWAYS DRAWN, even before anybody has placed it. A dial has a
            needle; one that blinks into existence the moment a team
            commits reads as a bug, and the graphic already says whose turn
            it is in words. Parked dead centre until it is moved. */}
        {(
          // NO EASING WHILE A FINGER IS ON IT. The transition exists for
          // the overlay, where a new guess arrives every so often and
          // should glide in rather than teleport. Under a live drag it is
          // the opposite of help: every move restarts a 170ms ease from
          // wherever the needle had got to, so it never tracks the cursor
          // and never settles - a third of frames showed no movement at
          // all and the rest lurched. Measured, then removed.
          <g
            className={dragged ? "wl-needle wl-dragging" : "wl-needle"}
            style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angleFor(guess ?? 50)}deg)` }}
          >
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - r * 0.985}
              stroke={INK}
              strokeWidth={Math.max(11, width * 0.033)}
              strokeLinecap="round"
            />
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy - r * 0.985}
              stroke={NEEDLE}
              strokeWidth={Math.max(5, width * 0.017)}
              strokeLinecap="round"
            />
          </g>
        )}

        {/* The hub, last, so it caps the needle. */}
        <circle
          cx={cx}
          cy={cy}
          r={Math.max(14, width * 0.055)}
          fill={NEEDLE}
          stroke={INK}
          strokeWidth={Math.max(3, width * 0.011)}
        />

        {/* The two ends of the spectrum, on the flat edge either side. */}
        <text
          x={0}
          y={cy + Math.round(width * 0.085)}
          textAnchor="start"
          style={{ ...outlined(Math.round(width * 0.045)), fill: "#ffffff", fontFamily: "var(--font-display)", fontSize: Math.round(width * 0.045) }}
        >
          {left.toUpperCase()}
        </text>
        <text
          x={width}
          y={cy + Math.round(width * 0.085)}
          textAnchor="end"
          style={{ ...outlined(Math.round(width * 0.045)), fill: "#ffffff", fontFamily: "var(--font-display)", fontSize: Math.round(width * 0.045) }}
        >
          {right.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
