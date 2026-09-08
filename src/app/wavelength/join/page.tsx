"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isRoomCode } from "@/lib/wavelength/room";
import { potMax, WIN_SCORE, other } from "@/lib/wavelength/engine";
import { useWaveGuest } from "@/components/wavelength/useWaveRoom";
import { WaveStage } from "@/components/wavelength/WaveStage";
import { WaveStyles } from "@/components/wavelength/OverlayBoard";
import { PLAYER_COLORS, MONEY, display, outlined } from "@/components/versus/style";

// THE SECOND PAIR OF HANDS.
//
// Open this on a phone, put in the code the board shows, and you are the
// one turning the dial - from the sofa, from another city, from wherever.
// The board still runs the game: it deals, it reveals, it scores. All that
// crosses from here is a number.
//
// IT SEES WHAT THE STREAM SEES, which now includes the target for the
// couple of seconds the psychic is holding the dial open. That was a
// deliberate trade - the reveal is a beat everybody is meant to watch -
// and it means this is a link for the people PLAYING rather than a link
// that is safe to hand to whoever is guessing against you.
//
// Deliberately unlinked and noindexed - see ../layout.tsx.

const RULE = "rgba(255,255,255,0.10)";

// How long the dial keeps showing what YOU did rather than what the board
// says. Every move is echoed back through the board, so without this the
// needle fights the drag: you push it right, the echo of a value from
// 80ms ago pulls it left. Long enough to cover the round trip, short
// enough that letting go hands control straight back.
const LOCAL_MS = 500;

function JoinInner() {
  const params = useSearchParams();
  const fromUrl = params.get("room");
  const [typed, setTyped] = useState("");
  const code = fromUrl && isRoomCode(fromUrl) ? fromUrl : isRoomCode(typed) ? typed : null;

  const { message, live, move } = useWaveGuest(code);
  const state = message?.state ?? null;

  // The optimistic value, and the timer that gives it back.
  const [local, setLocal] = useState<number | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onScrub(value: number) {
    if (clear.current) clearTimeout(clear.current);
    setLocal(value);
    move(value);
    clear.current = setTimeout(() => setLocal(null), LOCAL_MS);
  }

  // The dial is live in exactly the phases the board would accept a move
  // in. Anything else and the reducer would refuse it anyway - better the
  // needle simply does not move than that it moves and nothing happens.
  const canMove = state !== null && (state.phase === "clue" || state.phase === "guess");
  // Straight from the wire once the round is over, so the reveal is never
  // drawn with a stale local needle on it.
  const shown = state === null ? null : canMove && local !== null ? { ...state, guess: local } : state;

  // WHAT IS HAPPENING, in the board's own words. Worked out from the same
  // state the board is drawing, so the two screens cannot end up saying
  // different things about the same moment.
  const status = (() => {
    if (!shown) return { line: "", color: "#ffffff", note: "" };
    const psychic = shown.teams[shown.psychic];
    const guessing = shown.teams[other(shown.psychic)];
    const coop = shown.mode === "coop";

    if (shown.phase === "done") {
      if (coop) return { line: `${shown.pot} OUT OF ${potMax(shown.runLength)}`, color: MONEY, note: "run over" };
      const winner = shown.teams[0].score >= WIN_SCORE ? 0 : 1;
      return { line: `${shown.teams[winner].name.toUpperCase()} WINS`, color: PLAYER_COLORS[winner], note: "" };
    }
    if (shown.phase === "reveal" && shown.scored) {
      const band = shown.scored.band;
      return {
        line: band > 0 ? `+${band}` : "MISSED",
        color: band > 0 ? MONEY : "rgba(255,255,255,0.6)",
        note: shown.scored.stolen ? `${guessing.name} called the side, +1` : "the board deals the next one",
      };
    }
    if (shown.phase === "steal") {
      return {
        line: `${guessing.name.toUpperCase()} SAYS ${shown.steal === "left" ? "LEFT" : "RIGHT"}`,
        color: PLAYER_COLORS[other(shown.psychic)],
        note: "dial locked",
      };
    }
    // clue or guess: the dial is yours.
    return {
      line: "DRAG THE NEEDLE",
      color: "rgba(255,255,255,0.85)",
      note: coop ? `${psychic.name} is the psychic` : `${psychic.name}'s clue`,
    };
  })();

  if (!code) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-4 pb-16 pt-12">
        <h1 className="text-center text-[clamp(1.5rem,7vw,2.2rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          JOIN THE DIAL
        </h1>
        <p className="mt-2 text-center text-sm text-white/50">
          Put in the code from the board and you are the one turning it.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value.trim().toLowerCase())}
          placeholder="room code"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-6 rounded-xl border-2 bg-white/[0.04] px-4 py-3 text-center text-[18px] tracking-[0.25em] outline-none transition-colors focus:border-white/45"
          style={{ borderColor: RULE, fontFamily: "var(--font-display)" }}
        />
        {typed !== "" && !isRoomCode(typed) && (
          <p className="mt-2 text-center text-[12px] text-white/35">
            Ten characters, no 0, 1, l, I or O &mdash; those are left out so a code can be read off a screen.
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pb-10 pt-3">
      {/* The dial has a lid, and a lid with no keyframes never opens - so
          the graphic's stylesheet has to be on this page too. */}
      <WaveStyles />
      <div className="flex items-center justify-between gap-3 px-1">
        <span style={{ ...display(11, { letterSpacing: 3, color: "rgba(255,255,255,0.32)" }) }}>
          ON THE DIAL
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-white/40">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: state ? "#00e35f" : live ? "#ffd23a" : "rgba(255,255,255,0.25)" }}
          />
          {state ? code : live ? "waiting for the board" : "connecting"}
        </span>
      </div>

      {shown ? (
        <>
          <WaveStage state={shown} onScrub={canMove ? onScrub : undefined} />

          {/* EVERYTHING THE BOARD KNOWS, minus the buttons that run it.
              The graphic is deliberately bare now - it is a stream layer,
              not a status readout - so the round, the turn and the result
              are printed here instead, the same way they are on the board
              screen. The one thing this page never shows is the target
              before the reveal, and that is not a decision made here: it
              is not in the message. */}
          <div className="mt-1 flex flex-col gap-2 border-t pt-4" style={{ borderColor: RULE }}>
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(11, { letterSpacing: 3, color: "rgba(255,255,255,0.32)" }) }}>
                {shown.mode === "coop"
                  ? `ROUND ${Math.min(shown.round, shown.runLength)} OF ${shown.runLength}`
                  : `ROUND ${shown.round} · FIRST TO ${WIN_SCORE}`}
              </span>
              <span className="text-[11px] text-white/35">
                {shown.mode === "coop"
                  ? `${shown.pot} of ${potMax(shown.runLength)}`
                  : `${shown.teams[0].name} ${shown.teams[0].score} — ${shown.teams[1].score} ${shown.teams[1].name}`}
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-3">
              <span style={{ ...display(18, { color: status.color, letterSpacing: 1 }), ...outlined(18, "soft") }}>
                {status.line}
              </span>
              {status.note && <span className="text-[12px] text-white/40">{status.note}</span>}
            </div>
          </div>
        </>      ) : (
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-center text-[13px] text-white/35">
            {live ? "Connected. Waiting for the board to start a game." : "Connecting to the room…"}
          </p>
        </div>
      )}
    </main>
  );
}

export default function JoinPage() {
  // useSearchParams needs a boundary for this route to stay prerenderable.
  return (
    <Suspense fallback={null}>
      <JoinInner />
    </Suspense>
  );
}
