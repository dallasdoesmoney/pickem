import type { CSSProperties } from "react";

// ONE LOOK FOR BOTH SCREENS.
//
// The overlay and the control board are the same game seen from two
// sides, and they were drifting: the overlay was chunky outlined
// lettering over a transparent ground, the board was the site's quiet
// dark panels. Playing on one and watching the other felt like two
// different products, which is the wrong impression to give somebody
// three seconds into a clip.
//
// So the vocabulary lives here and both import it. The board keeps its
// panels - it is a page you sit and read, not a graphic over a face cam -
// but the type, the colours and the money all come from the same place.

// One colour each, held for a whole draft. A viewer learns them in the
// first ten seconds and never has to read a label again.
export const PLAYER_COLORS = ["#3aa8ff", "#ffd23a"];
export const MONEY = "#00e35f";
export const INK = "#05070d";

// A black outline heavy enough to hold up over a moving camera feed.
// -webkit-text-stroke alone thins the letterform, because it draws
// centred on the edge; the shadow puts the weight back on the outside.
//
// `depth` is for the board, where there is no camera underneath and the
// full outline reads as shouting - the same family, quieter.
export function outlined(px: number, depth: "full" | "soft" = "full"): CSSProperties {
  const o = Math.max(2, Math.round(px * (depth === "full" ? 0.06 : 0.035)));
  return {
    WebkitTextStroke: `${o}px ${INK}`,
    paintOrder: "stroke fill",
    textShadow: depth === "full" ? `0 ${Math.round(o * 1.6)}px 0 rgba(5,7,13,0.85)` : `0 ${o}px 0 rgba(5,7,13,0.6)`,
  };
}

// THE SPIN. One number, in one place, because two things depend on it and
// they must not disagree: the reel's CSS transition, and the timer the
// board sets before it tells everyone bidding is open. The reel lands a
// beat early on purpose - the winning team sits there for a moment before
// the bidding controls appear under it.
export const SPIN_MS = 2600;
export const REEL_MS = 2250;

// Every lot is drawn in a box of exactly this height, whether it is
// spinning, landed, or not yet started. A fixed cell is what makes the
// reel stop dead on the real thing instead of the layout jumping as the
// graphic swaps from an animation to a static lot.
export const LOT_CELL_H = 260;

export const display = (size: number, extra: CSSProperties = {}): CSSProperties => ({
  fontFamily: "var(--font-display)",
  fontSize: size,
  lineHeight: 1,
  ...extra,
});
