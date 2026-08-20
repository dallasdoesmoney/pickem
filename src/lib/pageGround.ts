// The page ground, and how a team-tinted page derives from it.
//
// Kept in step with --background in globals.css by hand; there is no way
// to read a CSS custom property at module scope, and the predictor needs
// the value as numbers rather than as a string it can hand to CSS.
export const GROUND = "#070e1c";

function channels(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

// WCAG relative luminance - the standard model of how light a colour
// actually looks, rather than how large its numbers are. Needed because
// the channels are wildly misleading here: Pittsburgh's yellow and
// Chicago's navy are nowhere near each other perceptually even when
// scaled by the same factor.
function luminance([r, g, b]: number[]): number {
  const channel = (value: number) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

const GROUND_RGB = channels(GROUND);
const GROUND_LUMINANCE = luminance(GROUND_RGB);

// Every team page sits at this multiple of the site ground: dark enough
// to read as the same site, lifted just enough that the tint is visible
// at all.
const TARGET = GROUND_LUMINANCE * 2;

function mix(team: number[], amount: number): number[] {
  return GROUND_RGB.map((ground, i) => Math.round(ground + (team[i] - ground) * amount));
}

// The predictor used to multiply the team colour down to a fixed
// fraction of its own brightness. That preserves the tint but not the
// darkness: one factor left Pittsburgh's yellow fifteen times lighter
// than the ground while Las Vegas's black sat darker than it, and once
// the site ground went darker the bright teams read as lit pages.
//
// So the tint amount is solved per team instead of fixed. Every page
// lands on the same luminance, and how much team colour that takes
// varies - a lot for a navy team, very little for a yellow one. A team
// whose own colour is darker than the ground cannot tint it at all, so
// it just gets the ground rather than something darker than the rest of
// the site.
export function tintedGround(teamHex: string): string {
  const team = channels(teamHex);
  const rgb = luminance(team) <= GROUND_LUMINANCE ? GROUND_RGB : solve(team);
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function solve(team: number[]): number[] {
  // Binary search rather than algebra: luminance is piecewise and
  // gamma-curved, and 24 halvings of a 0-1 range is exact to well under
  // one 8-bit step.
  if (luminance(team) < TARGET) return team;
  let low = 0;
  let high = 1;
  for (let i = 0; i < 24; i++) {
    const guess = (low + high) / 2;
    if (luminance(mix(team, guess)) < TARGET) low = guess;
    else high = guess;
  }
  return mix(team, high);
}
