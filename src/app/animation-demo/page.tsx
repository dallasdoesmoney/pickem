"use client";

import { useState } from "react";
import { TEAMS } from "@/data/teams";

// Temporary side-by-side demo of candidate "suspicious pick" badge
// animations - not linked from the nav. Delete once a winner is picked.
const VARIANTS = [
  { id: "jumbo", name: "1. Jumbo zoom-out (smoothed)", blurb: "Huge and in your face, then one smooth glide back to the corner. Now live on the predictor." },
  { id: "zoomin", name: "2. Dramatic slow zoom-in", blurb: "Pops on, then the camera slowly pushes into his face before snapping back." },
  { id: "slide", name: "3. Slide-eye reveal", blurb: "Slides in straight-faced, stops... then snaps the head-tilt." },
  { id: "drop", name: "4. Bounce drop", blurb: "Drops from above, squashes on impact, boings before settling." },
  { id: "creep", name: "5. Creep peek", blurb: "Inches up over the corner reeeal slow, pauses mid-rise to stare." },
];

function DemoCard({ variant }: { variant: string }) {
  const dal = TEAMS.DAL;
  const ind = TEAMS.IND;
  return (
    <div className="relative isolate flex items-center shrink-0" style={{ width: 343 }}>
      <div className="relative flex-1 rounded-l-full overflow-hidden" style={{ height: 80, backgroundColor: dal.color, border: "5px solid #ef4444", borderRight: "5px solid #ef4444" }}>
        <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: 54 }}>
          <img src={dal.logo} alt="" className="h-[117px] w-auto max-w-none" crossOrigin="anonymous" />
        </div>
        <div className="absolute inset-x-0 bottom-0" style={{ height: 26, backgroundColor: "rgba(0,32,89,0.93)" }} />
        <span
          className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-center text-6xl"
          style={{
            height: 54,
            fontFamily: "var(--font-display)",
            color: "#ef4444",
            transform: "rotate(-12deg)",
            textShadow: "-1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff",
          }}
        >
          L
        </span>
      </div>
      <div className="relative flex-1 rounded-r-full overflow-hidden" style={{ height: 80, backgroundColor: ind.color, border: "4px solid #8c8c8c", borderLeft: "none", filter: "grayscale(0.5) brightness(0.55)" }}>
        <div className="absolute inset-x-0 top-0 flex items-center justify-center" style={{ height: 54 }}>
          <img src={ind.logo} alt="" className="h-[117px] w-auto max-w-none" crossOrigin="anonymous" />
        </div>
        <div className="absolute inset-x-0 bottom-0" style={{ height: 26, backgroundColor: "rgba(0,26,56,0.93)" }} />
      </div>
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center text-white/50 text-xs tracking-wide z-20"
        style={{ height: 26, fontFamily: "var(--font-display)" }}
      >
        WEEK 9
      </span>
      <img
        src="/suspicious-dog.png"
        alt=""
        className={`absolute -top-2.5 z-40 h-11 w-auto pointer-events-none select-none demo-${variant}`}
        style={{
          right: "-10px",
          "--peek-rot": "22deg",
          transform: "rotate(22deg)",
          filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
        } as React.CSSProperties}
      />
    </div>
  );
}

export default function AnimationDemoPage() {
  const [replayKeys, setReplayKeys] = useState<Record<string, number>>({});

  return (
    <main className="flex-1 px-4 pb-16 pt-8 max-w-2xl w-full mx-auto">
      <style>{`
        .demo-jumbo {
          animation: demo-jumbo 1.5s cubic-bezier(0.35, 0, 0.15, 1) both;
          transform-origin: 60% 60%;
        }
        @keyframes demo-jumbo {
          0% { opacity: 0; transform: translate(-120px, 90px) rotate(4deg) scale(5.4); }
          20% { opacity: 1; transform: translate(-120px, 90px) rotate(4deg) scale(5); }
          45% { opacity: 1; transform: translate(-120px, 90px) rotate(4deg) scale(5); }
          100% { transform: translate(0, 0) rotate(var(--peek-rot)) scale(1); }
        }

        .demo-zoomin {
          animation: demo-zoomin 2.6s ease-in-out both;
          transform-origin: 45% 40%;
        }
        @keyframes demo-zoomin {
          0% { opacity: 0; transform: rotate(var(--peek-rot)) scale(0.9); }
          8% { opacity: 1; transform: rotate(var(--peek-rot)) scale(1); }
          30% { transform: rotate(var(--peek-rot)) scale(1); }
          85% { transform: rotate(calc(var(--peek-rot) + 3deg)) scale(2.1); }
          90% { transform: rotate(calc(var(--peek-rot) + 3deg)) scale(2.1); }
          100% { transform: rotate(var(--peek-rot)) scale(1); }
        }

        .demo-slide {
          animation: demo-slide 1.5s ease-out both;
        }
        @keyframes demo-slide {
          0% { opacity: 0; transform: translateX(70px) rotate(0deg); }
          30% { opacity: 1; transform: translateX(0) rotate(0deg); }
          62% { transform: translateX(0) rotate(0deg); }
          72% { transform: translateX(0) rotate(30deg); }
          82% { transform: translateX(0) rotate(18deg); }
          100% { transform: translateX(0) rotate(var(--peek-rot)); }
        }

        .demo-drop {
          animation: demo-drop 1s cubic-bezier(0.34, 1.3, 0.64, 1) both;
          transform-origin: 50% 100%;
        }
        @keyframes demo-drop {
          0% { opacity: 0; transform: translateY(-90px) rotate(var(--peek-rot)) scale(1); }
          15% { opacity: 1; }
          45% { transform: translateY(6px) rotate(var(--peek-rot)) scale(1.25, 0.65); }
          62% { transform: translateY(-14px) rotate(var(--peek-rot)) scale(0.92, 1.1); }
          78% { transform: translateY(2px) rotate(var(--peek-rot)) scale(1.08, 0.9); }
          100% { transform: translateY(0) rotate(var(--peek-rot)) scale(1); }
        }

        .demo-creep {
          animation: demo-creep 2.4s ease-in-out both;
        }
        @keyframes demo-creep {
          0% { opacity: 0; transform: translateY(34px) rotate(6deg) scale(0.85); }
          10% { opacity: 1; }
          40% { transform: translateY(16px) rotate(10deg) scale(0.92); }
          58% { transform: translateY(16px) rotate(10deg) scale(0.92); }
          90% { transform: translateY(-2px) rotate(var(--peek-rot)) scale(1.02); }
          100% { transform: translateY(0) rotate(var(--peek-rot)) scale(1); }
        }
      `}</style>

      <h1 className="text-2xl mb-2 text-center" style={{ fontFamily: "var(--font-display)" }}>
        SUSPICIOUS DOG AUDITIONS
      </h1>
      <p className="text-sm text-white/50 text-center mb-10">Hit replay on each to compare. Pick a number.</p>

      <div className="flex flex-col gap-10">
        {VARIANTS.map((v) => (
          <div key={v.id} className="flex flex-col items-center gap-3">
            <div className="text-center">
              <div className="text-sm text-white" style={{ fontFamily: "var(--font-display)" }}>{v.name}</div>
              <div className="text-xs text-white/50 mt-0.5">{v.blurb}</div>
            </div>
            <DemoCard key={`${v.id}-${replayKeys[v.id] ?? 0}`} variant={v.id} />
            <button
              onClick={() => setReplayKeys((p) => ({ ...p, [v.id]: (p[v.id] ?? 0) + 1 }))}
              className="text-xs text-white/60 hover:text-white rounded-full px-4 py-1.5 border border-white/20 hover:border-white/40 transition-colors"
              style={{ fontFamily: "var(--font-display)" }}
            >
              REPLAY
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
