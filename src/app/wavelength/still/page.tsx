"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { WavelengthState } from "@/lib/wavelength/engine";
import { OverlayBoard, WaveStyles, STAGE_W, STAGE_H } from "@/components/wavelength/OverlayBoard";
import { DEFAULT_BANDS, isBandPalette, type BandPalette } from "@/components/wavelength/Dial";
import { display } from "@/components/versus/style";

// ============================================================================
// TEMPORARY. A RESCUE TOOL, NOT A FEATURE.
// ============================================================================
//
// A stream got recorded where the overlay never showed the psychic opening
// the dial, so the footage has a hole in it exactly where the wedge should
// have appeared. This page exists to fill that hole in an editor: the same
// graphic, the same 1080 x 1920 transparent stage, the needle nailed
// straight up, the lid already open - and the WEDGE draggable, so the
// scoring bands can be put wherever the footage needs them.
//
// It is not linked from anywhere and it is not part of the game. When the
// footage is patched, delete this file and its route. The thing it is
// working around is fixed; this is only here to repair what was already
// recorded.
//
// HOW TO GET A COMPOSITE-READY FRAME OUT OF IT:
//
//   1. Set it up here - words, scores, clue, and drag the wedge into
//      place.
//   2. Press COPY, which gives you the same URL with the controls off.
//   3. Paste that into the OBS browser source you already have pointed at
//      the overlay (1080 x 1920).
//   4. Right-click the source in OBS and pick "Screenshot (Source)". That
//      writes a PNG WITH ITS ALPHA, which drops straight over the footage.
//
// Everything is in the URL rather than in storage precisely so step 3
// works: an OBS browser source has its own localStorage and would not see
// anything set up over here.

const RULE = "rgba(255,255,255,0.12)";

function num(value: string | null, fallback: number): number {
  const n = Number(value);
  return value !== null && Number.isFinite(n) ? n : fallback;
}

function StillInner() {
  const params = useSearchParams();

  // Seeded from the URL so a copied link reproduces the frame exactly,
  // then held in state so it can be nudged without a reload.
  const [left, setLeft] = useState(params.get("left") ?? "Bad song");
  const [right, setRight] = useState(params.get("right") ?? "Banger");
  const [clue, setClue] = useState(params.get("clue") ?? "");
  const [target, setTarget] = useState(num(params.get("target"), 50));
  const [coop, setCoop] = useState(params.get("mode") === "coop");
  const [s1, setS1] = useState(num(params.get("s1"), 0));
  const [s2, setS2] = useState(num(params.get("s2"), 0));
  const [pot, setPot] = useState(num(params.get("pot"), 0));
  const [runLength, setRunLength] = useState(num(params.get("run"), 5));
  const [psychic, setPsychic] = useState<0 | 1>(params.get("psychic") === "2" ? 1 : 0);
  const [camTop, setCamTop] = useState(num(params.get("top"), 560));
  const [camBottom, setCamBottom] = useState(num(params.get("bottom"), 560));
  const [copied, setCopied] = useState(false);

  const bandsParam = params.get("bands");
  const bands: BandPalette = isBandPalette(bandsParam) ? bandsParam : DEFAULT_BANDS;
  const clean = params.get("clean") === "1";

  // THE ONE FRAME. Built by hand rather than played into, because there is
  // no game here - just a position somebody needs a picture of.
  //
  // guess is 50 and never moves: the needle points straight up so it reads
  // as "here is the board, before anybody has guessed". peek is "open", so
  // the lid is up and the wedge is drawn - which is exactly the moment the
  // recording is missing.
  const state: WavelengthState = {
    deck: "still",
    mode: coop ? "coop" : "teams",
    pot,
    runLength: coop ? Math.max(1, runLength) : 0,
    teams: [
      { name: "Team 1", score: s1 },
      { name: "Team 2", score: s2 },
    ],
    psychic,
    round: 1,
    phase: "clue",
    card: { id: "still", left, right },
    seen: [],
    target,
    peek: "open",
    clue,
    guess: 50,
    steal: null,
    scored: null,
  };

  const query = new URLSearchParams({
    left,
    right,
    clue,
    target: String(target),
    mode: coop ? "coop" : "teams",
    s1: String(s1),
    s2: String(s2),
    pot: String(pot),
    run: String(runLength),
    psychic: psychic === 1 ? "2" : "1",
    top: String(camTop),
    bottom: String(camBottom),
    bands,
    clean: "1",
  });
  const cleanUrl = typeof window === "undefined" ? "" : `${window.location.origin}/wavelength/still?${query}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(cleanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused. The field below is selectable.
    }
  }

  const stage = (
    <div
      style={{
        width: STAGE_W,
        height: STAGE_H,
        position: clean ? "fixed" : "absolute",
        top: 0,
        left: clean ? 0 : "50%",
        transform: clean ? undefined : "translateX(-50%) scale(var(--still-scale, 0.4))",
        transformOrigin: "top center",
      }}
    >
      {/* THE WEDGE IS WHAT DRAGS, not the needle. Dial reports whatever
          value the pointer is over; here that is wired to the target, so
          the bands follow your finger and the needle stays where it is. */}
      <OverlayBoard
        state={state}
        camTop={camTop}
        camBottom={camBottom}
        bands={bands}
        onScrub={clean ? undefined : setTarget}
      />
    </div>
  );

  if (clean) {
    return (
      <>
        <WaveStyles />
        <style>{`
          html, body { background: transparent !important; }
          body > svg[aria-hidden="true"] { display: none !important; }
          body { overflow: hidden; }
        `}</style>
        {stage}
      </>
    );
  }

  return (
    <>
      <WaveStyles />
      <style>{`
        html, body { background: #0a0f1a !important; }
        body > svg[aria-hidden="true"] { display: none !important; }
        .still-void { background: repeating-conic-gradient(#59617a 0% 25%, #444b60 0% 50%) 50% / 64px 64px; }
      `}</style>
      {/* Scales the stage to whatever is left beside the controls. Same
          trick the overlay preview uses: a script rather than a resize
          effect, so it is right on the first paint. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){function f(){var w=Math.max(320,innerWidth-460);document.documentElement.style.setProperty("--still-scale",Math.min(w/${STAGE_W},(innerHeight-40)/${STAGE_H}));}f();addEventListener("resize",f);})();`,
        }}
      />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 24, padding: 20 }}>
        <div style={{ position: "relative", flex: "1 1 auto", minWidth: 320, height: "calc(100vh - 40px)" }}>
          <div aria-hidden className="still-void" style={{ position: "absolute", inset: 0, borderRadius: 10 }} />
          {stage}
        </div>

        <div style={{ width: 400, flex: "0 0 400px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ ...display(15, { letterSpacing: 2, color: "#ffd23a" }) }}>STILL FRAME — TEMPORARY</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/45">
              Drag anywhere on the dial to move the <strong className="font-normal text-white/70">points</strong>.
              The needle stays straight up and the lid stays open. Set the rest to match your
              footage, then copy the clean URL into your OBS browser source and use{" "}
              <strong className="font-normal text-white/70">right-click &rarr; Screenshot (Source)</strong> —
              that saves a PNG with transparency.
            </p>
          </div>

          <label className="flex flex-col gap-1">
            <span style={{ ...display(10, { letterSpacing: 2, color: "rgba(255,255,255,0.35)" }) }}>
              POINTS AT {target.toFixed(1)}
            </span>
            <input
              type="range"
              min={0}
              max={100}
              step={0.1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value))}
              aria-label="Where the points are"
              className="h-8 w-full"
              style={{ accentColor: "#ff5a24" }}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <Field label="LEFT END" value={left} onChange={setLeft} />
            <Field label="RIGHT END" value={right} onChange={setRight} />
          </div>
          <Field label="CLUE (BLANK FOR NONE)" value={clue} onChange={setClue} />

          <div className="flex gap-2">
            <Toggle on={!coop} label="TEAM VS TEAM" onClick={() => setCoop(false)} />
            <Toggle on={coop} label="CO-OP" onClick={() => setCoop(true)} />
          </div>

          {coop ? (
            <div className="grid grid-cols-2 gap-2">
              <NumField label="POT" value={pot} onChange={setPot} />
              <NumField label="ROUNDS IN THE RUN" value={runLength} onChange={setRunLength} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <NumField label="SCORE LEFT" value={s1} onChange={setS1} />
              <NumField label="SCORE RIGHT" value={s2} onChange={setS2} />
            </div>
          )}

          <div className="flex gap-2">
            <Toggle on={psychic === 0} label="PSYCHIC LEFT" onClick={() => setPsychic(0)} />
            <Toggle on={psychic === 1} label="PSYCHIC RIGHT" onClick={() => setPsychic(1)} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumField label="TOP CAM" value={camTop} onChange={setCamTop} />
            <NumField label="BOTTOM CAM" value={camBottom} onChange={setCamBottom} />
          </div>

          <div className="flex gap-2 border-t pt-3" style={{ borderColor: RULE }}>
            <input
              readOnly
              value={cleanUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-xl bg-black/30 px-3 py-2.5 text-[11px] text-white/55 outline-none"
              style={{ border: `2px solid ${RULE}` }}
            />
            <button
              onClick={copy}
              className="shrink-0 rounded-xl px-4 text-[12px] tracking-[0.14em] text-[#05070d]"
              style={{ fontFamily: "var(--font-display)", background: "#3ecb78" }}
            >
              {copied ? "COPIED" : "COPY"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span style={{ ...display(10, { letterSpacing: 2, color: "rgba(255,255,255,0.35)" }) }}>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-0 rounded-lg bg-white/[0.05] px-2.5 py-2 text-[13px] text-white outline-none transition-colors focus:border-white/45"
        style={{ border: `2px solid ${RULE}` }}
      />
    </label>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span style={{ ...display(10, { letterSpacing: 2, color: "rgba(255,255,255,0.35)" }) }}>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="min-w-0 rounded-lg bg-white/[0.05] px-2.5 py-2 text-[13px] text-white outline-none"
        style={{ border: `2px solid ${RULE}` }}
      />
    </label>
  );
}

function Toggle({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex-1 rounded-lg py-2 transition-colors"
      style={{
        ...display(11, { letterSpacing: 1.5, color: on ? "#05070d" : "rgba(255,255,255,0.6)" }),
        background: on ? "#3ecb78" : "transparent",
        border: `2px solid ${on ? "#3ecb78" : RULE}`,
      }}
    >
      {label}
    </button>
  );
}

export default function StillPage() {
  // useSearchParams needs a boundary for this route to stay prerenderable.
  return (
    <Suspense fallback={null}>
      <StillInner />
    </Suspense>
  );
}
