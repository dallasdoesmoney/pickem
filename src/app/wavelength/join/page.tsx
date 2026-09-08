"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { isRoomCode } from "@/lib/wavelength/room";
import { useWaveGuest } from "@/components/wavelength/useWaveRoom";
import { WaveStage } from "@/components/wavelength/WaveStage";
import { display } from "@/components/versus/style";

// THE SECOND PAIR OF HANDS.
//
// Open this on a phone, put in the code the board shows, and you are the
// one turning the dial - from the sofa, from another city, from wherever.
// The board still runs the game: it deals, it reveals, it scores. All that
// crosses from here is a number.
//
// WHICH MEANS THIS PAGE IS SAFE TO BE THE GUESSER'S, and that is not a
// happy accident. A guest is handed exactly the message the OBS browser
// source gets, and the target is not in it until the reveal - so the
// person guessing genuinely cannot see the answer, without anybody having
// to be trusted not to look.
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
          <div className="mt-1 border-t pt-4 text-center" style={{ borderColor: RULE }}>
            {canMove ? (
              <>
                <p style={{ ...display(16, { letterSpacing: 1, color: "rgba(255,255,255,0.8)" }) }}>DRAG THE NEEDLE</p>
                <p className="mt-1.5 text-[12px] text-white/40">
                  {shown.card.left} on the left, {shown.card.right} on the right. Say when you are happy
                  &mdash; the board opens it.
                </p>
              </>
            ) : (
              <p className="text-[12.5px] text-white/40">
                {shown.phase === "steal" ? "Waiting on the call." : "The board has it from here."}
              </p>
            )}
          </div>
        </>
      ) : (
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
