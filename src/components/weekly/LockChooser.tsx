"use client";

import { LOCK_COLOR } from "@/components/TeamHalfPill";
import type { LockPrompt } from "@/components/GameCard";

// LOCK MODE.
//
// The session replays said almost nobody sets a Lock of the Week, and
// the reason was in GameCard: the padlock is only drawn on a game you
// have ALREADY picked, and even then at 45% opacity in greyscale, in a
// bottom corner, under a sticker. A fresh board had no padlock on it
// anywhere - measured, on the live board: zero badges before a pick.
//
// Which was expensive. A correct pick pays 25 points; a correct lock
// pays 250 on top. The one control nobody could find was worth ten times
// every other click on the page.
//
// The fix is a mode rather than a louder badge. The KPI pill - already
// the widest thing under the board, already outlined in the lock's own
// amber - becomes the button. Press it and the board stops being a
// board and becomes a chooser: every game you have not picked steps
// back, every pick you HAVE made lights its padlock, and a line above
// the grid says the one thing to do. One tap ends it.
//
// The pill is the right home for this because it is the thing that was
// showing a dash. The place that reported "you have no lock" is now the
// place you fix that, which is one less thing to find.

// What the board draws while the mode is on or off. `hidden` is the
// resting state and it is deliberate: outside lock mode the badge is
// noise on a card whose job is picking a winner, and it was never
// discoverable enough to be worth the pixels. The lock, once set, always
// shows - that is the "ghost" case.
export function lockPromptFor(choosing: boolean, hasLock: boolean): LockPrompt {
  if (hasLock) return "ghost";
  return choosing ? "loud" : "hidden";
}

// The instruction, above the grid, because the grid is what it is
// talking about. Only up while the mode is.
export function ChoosingBar({ hasPicks, scale = 1 }: { hasPicks: boolean; scale?: number }) {
  return (
    // w-fit, or it stretches the whole board width and stops reading as
    // a line of instruction. max-w-full so a narrow phone wraps it
    // instead of pushing the page sideways.
    //
    // The bottom margin has to clear the kickoff tab that pokes up above
    // the grid's first row - at mb-3 the bar sat on top of "WED 8:20PM".
    <div
      className="mx-auto mb-7 flex w-fit max-w-full items-center justify-center gap-2 rounded-full text-center"
      style={{
        background: "rgba(245,158,11,0.14)",
        border: `1px solid ${LOCK_COLOR}`,
        color: "#fde3a7",
        fontSize: Math.max(11, 13 * scale),
        padding: `${Math.max(5, 8 * scale)}px ${Math.max(12, 16 * scale)}px`,
      }}
    >
      <img src="/lock-of-week.png" alt="" className="w-auto" style={{ height: Math.max(18, 24 * scale) }} />
      {hasPicks ? "Tap the pick you're most confident in." : "Pick a winner first — your lock has to be one of them."}
    </div>
  );
}

// THE WORDS HAVE TO FIT, at every width this pill is drawn at - 144px
// across on a phone, 250 on a desktop, and anything between, times a
// zoom the user sets themselves. So the type is not a guess: it is
// solved from the width the text actually has.
//
// The padlock hangs off the top-left corner and overlaps the pill's
// interior, so the usable box is the pill minus that intrusion on the
// left and a plain margin on the right. Then the size is whichever is
// smaller - what the row height allows, or what the width allows for
// this many characters.
//
// 0.62em per character is Bungee's advance including its letter-spacing.
// Measured, not assumed: at 11px the string "SET YOUR LOCK" laid out at
// 89px, and 89 / (13 x 11) = 0.622. The browser check is what keeps that
// honest if the face ever changes.
//
// FLOOR, not round. Rounding up is how the first version of this
// overflowed by four pixels at 430px wide: 12.65 became 13, and three
// pixels times thirteen characters is wider than the pill. A tenth of a
// point smaller is invisible; a clipped K is not.
const CHAR_EM = 0.62;

export function fitPillText(text: string, pillWidth: number, lockIntrusion: number, rightMargin: number, max: number): number {
  const usable = pillWidth - lockIntrusion - rightMargin;
  return Math.max(9, Math.min(max, Math.floor(usable / (text.length * CHAR_EM))));
}
