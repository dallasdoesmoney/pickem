// The rule for sizing the three KPI pills that sit under the grid on
// both the weekly page and the predictor's team pages.
//
// They used to size off an `lg:` breakpoint while everything above them
// sized off the grid's solved scale, and the two don't line up. The grid
// reaches its full 0.85 scale at around 647px wide, so from 1023px all
// the way down to 647px the matchup cards were identical while the pills
// dropped to their phone size in a single step. On a 1000px window that
// reads as the page deciding you are on a phone when nothing else about
// it has changed.
//
// What actually constrains these pills is whether the row of three fits
// across the page, so that is what they follow. Riding the grid's scale
// instead would only trade the old cliff for the row wrapping onto two
// lines just under 650px, where the full-size row wants more width than
// there is.
const PHONE_WIDTH = 358; // content width on a 390px viewport
const FULL_WIDTH = 651; // what a full-size row of three needs, plus slack

// 0 at phone width, 1 once there is room for the row at full size.
export function kpiFraction(contentWidth: number): number {
  return Math.min(1, Math.max(0, (contentWidth - PHONE_WIDTH) / (FULL_WIDTH - PHONE_WIDTH)));
}

// Maps that fraction onto whatever a given element measured at each end,
// so both endpoints stay exactly where the breakpoint used to put them
// and only the middle that was missing gets filled in.
export function kpiSizer(fraction: number) {
  return (phone: number, desktop: number) => Math.round(phone + (desktop - phone) * fraction);
}
