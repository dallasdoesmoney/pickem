"use client";

import { useEffect, useState } from "react";
import { TierItem } from "@/data/tierTemplates";

const DROPS = 48;
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

// Sending a team to the top tier is the loudest thing that happens in this
// product, so it gets a real moment: the screen washes in the team's
// colour, their mark blooms out of the middle, their name lands across it,
// and then it rains them. Built to read on a stream - big shapes and hard
// motion rather than subtle fades, which compression eats.
export function TierCelebration({ item, onDone }: { item: TierItem | null; onDone: () => void }) {
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
      Array.from({ length: DROPS }, () => ({
        left: Math.random() * 100,
        // Roughly 2.5x what this started at. Small marks read as confetti
        // at streaming bitrates; at this size you can tell whose logo it is
        // while it falls, which is the whole point.
        size: 68 + Math.random() * 112,
        delay: Math.random() * 750,
        duration: 1500 + Math.random() * 1200,
        // A little horizontal travel so they don't fall like a grid.
        drift: Math.random() * 160 - 80,
        spin: Math.random() * 900 - 450,
        opacity: 0.55 + Math.random() * 0.45,
      }))
    );
    const t = setTimeout(onDone, TOTAL_MS);
    return () => clearTimeout(t);
  }, [item, onDone]);

  if (!item) return null;

  return (
    // Above the sticky header (z-50) so the moment owns the whole screen,
    // but below sheets and dialogs (z-[60]) so it can never trap anyone.
    // Never interactive - the board stays usable underneath it.
    <div className="fixed inset-0 z-[55] overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="tier-anim-flash absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 42%, ${item.accent} 0%, transparent 68%)` }}
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={item.imageUrl}
          alt=""
          crossOrigin="anonymous"
          className="tier-anim-bloom w-[46vmin] h-[46vmin] object-contain"
          style={{ filter: `drop-shadow(0 0 60px ${item.accent})` }}
        />
      </div>

      {/* Rain sits under the banner: at this size the storm would
          otherwise bury the one thing anyone needs to read. */}
      {drops.map((d, i) => (
        <img
          key={i}
          src={item.imageUrl}
          alt=""
          crossOrigin="anonymous"
          className="tier-anim-rain absolute top-0 object-contain"
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

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <div className="tier-anim-banner text-center">
          <div
            className="text-[clamp(2rem,9vw,5rem)] leading-none tracking-wide"
            style={{
              fontFamily: "var(--font-display)",
              color: "#ffffff",
              textShadow: `0 0 30px ${item.accent}, 0 4px 18px rgba(0,0,0,0.85)`,
            }}
          >
            {item.label.toUpperCase()}
          </div>
          <div
            className="text-[clamp(0.7rem,2.4vw,1.1rem)] tracking-[0.34em] mt-3"
            style={{ fontFamily: "var(--font-display)", color: item.accent }}
          >
            &#35;1 OVERALL
          </div>
        </div>
      </div>
    </div>
  );
}
