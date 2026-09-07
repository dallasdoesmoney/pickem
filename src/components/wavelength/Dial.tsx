"use client";

import { useCallback, useId, useRef } from "react";
import { DIAL_MAX, DIAL_MIN, BAND_2, BAND_3, BAND_4 } from "@/lib/wavelength/engine";
import { INK, MONEY, PLAYER_COLORS, outlined } from "@/components/versus/style";

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

// The case is cream now, not navy - it reads as a physical board game
// under a camera instead of a piece of software, and the green wedge and
// both player colours are louder against it.
export const CREAM = "#f6ecd6";
// WHAT IS UNDER THE LID IS STILL CREAM, a shade deeper. The first version
// made the recess navy, which looked right for the half second the lid was
// moving and then meant the whole face was dark blue for the entire
// reveal - which is the moment everybody is actually looking at it. The
// board is a cream board; opening it shows more cream, and the green is
// what arrives.
const SLOT = "#e3d3ac";

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
  // Which team is on the dial, for the needle's colour.
  team = 0,
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
  team?: number;
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

  const nudge = (by: number) => {
    if (!onScrub) return;
    const from = guess ?? 50;
    onScrub(Math.min(DIAL_MAX, Math.max(DIAL_MIN, Math.round((from + by) * 10) / 10)));
  };

  const BANDS: { from: number; to: number; fill: string; band: number }[] =
    target === null
      ? []
      : [
          { from: target - BAND_2, to: target + BAND_2, fill: "#2f6f4a", band: 2 },
          { from: target - BAND_3, to: target + BAND_3, fill: "#3f9e63", band: 3 },
          { from: target - BAND_4, to: target + BAND_4, fill: MONEY, band: 4 },
        ];
  // Which band the needle actually landed in, so only that one flashes.
  const hit = target !== null && guess !== null ? BANDS.filter((b) => guess >= b.from && guess <= b.to).pop() : null;

  const needleColor = PLAYER_COLORS[team] ?? PLAYER_COLORS[0];
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
              e.currentTarget.setPointerCapture(e.pointerId);
              scrubTo(e.clientX, e.clientY);
            },
            onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
              if (dragging.current) scrubTo(e.clientX, e.clientY);
            },
            onPointerUp: () => {
              dragging.current = false;
            },
            onPointerCancel: () => {
              dragging.current = false;
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
              fill={b.fill}
              opacity={0.96}
            />
          ))}
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
            {/* OUTLINED, and that outline is the point. Lid and recess are
                two shades of the same cream, so without a hard edge on the
                sweeping side the shutter would appear to dissolve rather
                than travel - and travelling is the whole trick. */}
            <path
              d={inner}
              fill={CREAM}
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
            ink under-stroke is what keeps a yellow needle legible on a
            cream face, and both of them legible over a camera. */}
        {guess !== null && (
          <g className="wl-needle" style={{ transformOrigin: `${cx}px ${cy}px`, transform: `rotate(${angleFor(guess)}deg)` }}>
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
              stroke={needleColor}
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
          fill={needleColor}
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
