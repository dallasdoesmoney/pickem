"use client";

import { useEffect, useState } from "react";
import { TierItem } from "@/data/tierTemplates";

// "promote" is the top tier: bright, fast, in colour. "bin" is the bottom
// tier: heavy, grey, slow. The contrast between them is the whole point -
// if both were spectacular, neither would mean anything.
export type CelebrationVariant = "promote" | "bin";

const PROMOTE_DROPS = 48;
const BIN_DROPS = 30;
// Longest possible drop (delay + duration) plus a beat, so nothing is cut
// off mid-fall when the overlay unmounts.
const TOTAL_MS = 3600;

type Drop = {
  left: number;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  opacity: number;
};

export function TierCelebration({
  item,
  variant = "promote",
  onDone,
}: {
  item: TierItem | null;
  variant?: CelebrationVariant;
  onDone: () => void;
}) {
  const bin = variant === "bin";

  // Rolled in an effect rather than a useMemo: randomness during render is
  // impure, and React is free to re-run a memo - which would reshuffle the
  // rain mid-fall. Generating after mount also keeps it out of the server
  // render entirely, so there's nothing to mismatch on hydration.
  const [drops, setDrops] = useState<Drop[]>([]);

  useEffect(() => {
    if (!item) {
      setDrops([]);
      return;
    }
    setDrops(
      Array.from({ length: bin ? BIN_DROPS : PROMOTE_DROPS }, () => ({
        left: Math.random() * 100,
        size: bin ? 40 + Math.random() * 70 : 68 + Math.random() * 112,
        delay: Math.random() * 750,
        // Slower on the way down when it's bad news.
        duration: bin ? 2000 + Math.random() * 1100 : 1500 + Math.random() * 1200,
        drift: Math.random() * 160 - 80,
        spin: Math.random() * 900 - 450,
        opacity: bin ? 0.4 + Math.random() * 0.35 : 0.55 + Math.random() * 0.45,
      }))
    );
    const t = setTimeout(onDone, TOTAL_MS);
    return () => clearTimeout(t);
  }, [item, bin, onDone]);

  if (!item) return null;

  return (
    // Above the sticky header (z-50) so the moment owns the whole screen,
    // but below sheets and dialogs (z-[60]) so it can never trap anyone.
    // Never interactive - the board stays usable underneath it.
    <div className="fixed inset-0 z-[55] overflow-hidden pointer-events-none" aria-hidden="true">
      {bin ? (
        <div className="tier-anim-bin-scrim absolute inset-0" style={{ background: "#05070d" }} />
      ) : (
        <div
          className="tier-anim-flash absolute inset-0"
          style={{ background: `radial-gradient(circle at 50% 42%, ${item.accent} 0%, transparent 68%)` }}
        />
      )}

      {!bin && (
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={item.imageUrl}
            alt=""
            crossOrigin="anonymous"
            className="tier-anim-bloom w-[46vmin] h-[46vmin] object-contain"
            style={{ filter: `drop-shadow(0 0 60px ${item.accent})` }}
          />
        </div>
      )}

      {/* Rain sits under the bin and the banner: at this size the storm
          would otherwise bury the thing it is falling around. */}
      {drops.map((d, i) => (
        <img
          key={i}
          src={item.imageUrl}
          alt=""
          crossOrigin="anonymous"
          className={`tier-anim-rain absolute top-0 object-contain ${bin ? "tier-anim-rain-grey" : ""}`}
          style={{
            left: `${d.left}%`,
            width: d.size,
            height: d.size,
            opacity: d.opacity,
            animationDelay: `${d.delay}ms`,
            animationDuration: `${d.duration}ms`,
            ["--rain-x" as string]: `${d.drift}px`,
            ["--rain-rot" as string]: `${d.spin}deg`,
          }}
        />
      ))}

      {bin && (
        <div className="absolute inset-0 flex items-end justify-center pb-[16vh]">
          <div
            className="tier-anim-bin-jolt relative"
            style={{ width: "clamp(190px, 32vmin, 320px)", aspectRatio: "150 / 154" }}
          >
            {/* Order matters: the mark sits BEHIND the bin's front, so it
                disappears into it on the way down rather than landing on
                top of it. That single detail is what sells the gag. */}
            <img
              src={item.imageUrl}
              alt=""
              crossOrigin="anonymous"
              className="tier-anim-bin-drop absolute object-contain"
              style={{ width: "52%", left: "24%", bottom: "62%" }}
            />
            <svg viewBox="0 0 150 128" className="absolute left-0 bottom-0 w-full" style={{ height: "83%" }}>
              <path d="M14 0 L136 0 L124 116 Q123 128 111 128 L39 128 Q27 128 26 116 Z" fill="#39414f" />
              <path d="M14 0 L136 0 L133 26 L17 26 Z" fill="#2f3743" />
              <rect x="46" y="30" width="9" height="86" rx="4" fill="#2b323d" />
              <rect x="71" y="30" width="9" height="86" rx="4" fill="#2b323d" />
              <rect x="96" y="30" width="9" height="86" rx="4" fill="#2b323d" />
            </svg>
            <svg
              viewBox="0 0 150 26"
              className="tier-anim-bin-lid absolute left-0 w-full"
              style={{ bottom: "83%", height: "17%" }}
            >
              <rect x="6" y="12" width="138" height="14" rx="6" fill="#525c6c" />
              <rect x="62" y="0" width="26" height="11" rx="5" fill="#525c6c" />
            </svg>
          </div>
        </div>
      )}

      <div className={`absolute inset-0 flex ${bin ? "items-end pb-[7vh]" : "items-center"} justify-center px-6`}>
        <div className={bin ? "tier-anim-bin-label text-center" : "tier-anim-banner text-center"}>
          <div
            className={bin ? "text-[clamp(1.3rem,5vw,2.6rem)] leading-none" : "text-[clamp(2rem,9vw,5rem)] leading-none"}
            style={{
              fontFamily: "var(--font-display)",
              color: bin ? "#94a3b8" : "#ffffff",
              textShadow: bin ? "0 3px 14px rgba(0,0,0,0.9)" : `0 0 30px ${item.accent}, 0 4px 18px rgba(0,0,0,0.85)`,
            }}
          >
            {item.label.toUpperCase()}
          </div>
          <div
            className="text-[clamp(0.7rem,2.4vw,1.1rem)] tracking-[0.34em] mt-3"
            style={{ fontFamily: "var(--font-display)", color: bin ? "#64748b" : item.accent }}
          >
            {bin ? "IN THE BIN" : "TOP TIER"}
          </div>
        </div>
      </div>
    </div>
  );
}
