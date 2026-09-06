"use client";

import { DIAL_MAX, DIAL_MIN, BAND_2, BAND_3, BAND_4 } from "@/lib/wavelength/engine";
import { INK, MONEY, PLAYER_COLORS, outlined } from "@/components/versus/style";

// THE DIAL. One component, drawn at whatever size it is handed, and it is
// the only thing on either screen that knows the game is a half-circle.
//
// SVG rather than rotated boxes, because the target is a WEDGE and the
// needle has to point at a number: an arc and a line are one path each in
// SVG and a pile of transforms in CSS. It also means the graphic scales
// to the 1080-wide OBS stage and down to a phone from the same source,
// which is the same reason the auction's stage is one fixed size scaled
// rather than a responsive layout.
//
// The palette is the versus palette on purpose - the same two player
// colours, the same money green, the same ink outline. Two games on one
// stream should look like one product.

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
  // Null hides the wedge entirely - which is most of the game.
  target,
  guess,
  // Which team is on the dial, for the needle's colour.
  team = 0,
  showTarget = false,
}: {
  width: number;
  left: string;
  right: string;
  target: number | null;
  guess: number | null;
  team?: number;
  showTarget?: boolean;
}) {
  // The face is a half-circle, so the box is half as tall as it is wide,
  // plus room under it for the hub and the two end labels.
  const r = width / 2;
  const cx = r;
  const cy = r;
  const h = r + Math.round(width * 0.14);

  const BANDS: { from: number; to: number; fill: string }[] =
    target === null || !showTarget
      ? []
      : [
          { from: target - BAND_2, to: target + BAND_2, fill: "#2f6f4a" },
          { from: target - BAND_3, to: target + BAND_3, fill: "#3f9e63" },
          { from: target - BAND_4, to: target + BAND_4, fill: MONEY },
        ];

  const needle = guess;
  const needleColor = PLAYER_COLORS[team] ?? PLAYER_COLORS[0];

  return (
    <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`} style={{ display: "block", overflow: "visible" }}>
      {/* THE FACE. A solid ground rather than a transparent one: the
          layer this sits on is over a camera, and a dial you can see a
          face through is not a dial. */}
      <path d={wedgePath(cx, cy, r, DIAL_MIN, DIAL_MAX)} fill="#0d1830" />
      <path
        d={wedgePath(cx, cy, r, DIAL_MIN, DIAL_MAX)}
        fill="none"
        stroke={INK}
        strokeWidth={Math.max(4, width * 0.012)}
      />

      {/* The scoring wedge, widest band first so the bullseye sits on
          top of it. Only ever drawn at the reveal. */}
      {BANDS.map((b, i) => (
        // Marked so a test can assert the wedge is not on screen before
        // the reveal - which is the one thing about this graphic that is
        // a rule rather than a decoration.
        <path key={i} data-wedge d={wedgePath(cx, cy, r * 0.97, b.from, b.to)} fill={b.fill} opacity={0.95} />
      ))}

      {/* Ticks, every ten. They give the eye something to measure a clue
          against - without them "just left of centre" has no centre. */}
      {Array.from({ length: 11 }, (_, i) => i * 10).map((v) => {
        const outer = pointAt(cx, cy, r * 0.97, v);
        const inner = pointAt(cx, cy, r * (v === 50 ? 0.84 : 0.9), v);
        return (
          <line
            key={v}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={Math.max(2, width * (v === 50 ? 0.008 : 0.004))}
          />
        );
      })}

      {/* THE NEEDLE. Drawn from the hub past the rim, with an ink
          under-stroke so it holds its shape over the wedge and over the
          camera alike. */}
      {needle !== null && (
        <>
          <line
            x1={cx}
            y1={cy}
            x2={pointAt(cx, cy, r * 0.99, needle).x}
            y2={pointAt(cx, cy, r * 0.99, needle).y}
            stroke={INK}
            strokeWidth={Math.max(9, width * 0.028)}
            strokeLinecap="round"
          />
          <line
            x1={cx}
            y1={cy}
            x2={pointAt(cx, cy, r * 0.99, needle).x}
            y2={pointAt(cx, cy, r * 0.99, needle).y}
            stroke={needleColor}
            strokeWidth={Math.max(5, width * 0.017)}
            strokeLinecap="round"
          />
        </>
      )}

      {/* The hub, last, so it caps the needle. */}
      <circle cx={cx} cy={cy} r={Math.max(14, width * 0.055)} fill={needleColor} stroke={INK} strokeWidth={Math.max(3, width * 0.009)} />

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
  );
}
