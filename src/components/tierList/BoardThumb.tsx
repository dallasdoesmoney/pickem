"use client";

import { useState } from "react";
import { TierItem, TierItemStyle, TierTemplate, resolveItem } from "@/data/tierTemplates";
import { TierListState, createInitialState, tierLabelFor } from "@/lib/tierList";
import { BACKDROP_OPACITY, BACKDROP_SCALE, BUNGEE_ADVANCE, surname } from "./TierItemChip";
import { TIER_LABEL_FONT, TIER_LABEL_LEADING } from "./tierLabel";

// Shared by the tier-list hub and the home page, which both front a
// board with the same piece of art - a saved list is recognised by its
// shape long before anyone reads its name, so the two places that
// advertise one have to draw it identically.

// A mark, falling back to a plain tile rather than a broken image - these
// are remote, and a card full of broken icons is worse than a card of
// blanks.
export function Mark({ item, size, style = "mark" }: { item: TierItem; size: number; style?: TierItemStyle }) {
  const [failed, setFailed] = useState(false);
  if (failed || !item.imageUrl) {
    return (
      <span
        aria-hidden
        className="shrink-0 rounded-[3px]"
        style={{ width: size, height: size, background: item.accent, opacity: 0.85 }}
      />
    );
  }
  // Portraits crop to fill on a team-coloured plate, the same as the
  // board's own chips - fitted whole at thumbnail size a headshot is a
  // speck in a letterbox. No caption here: at eight pixels a surname is
  // a smudge, and these previews are read as a shape, not a roster.
  if (style === "portrait") {
    return (
      <span
        aria-hidden
        className="shrink-0 overflow-hidden rounded-[3px]"
        style={{ width: size, height: size, background: item.accent }}
      >
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          crossOrigin="anonymous"
          className="h-full w-full object-cover object-top"
        />
      </span>
    );
  }
  return (
    <img
      src={item.imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      crossOrigin="anonymous"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

// A category has no ranking of its own, so its card art is an invented
// one. Seeded off the slug rather than Math.random: the same category
// must draw the same board on the server and on the client, or hydration
// tears - and a preview that reshuffles on every render is just noise.
export function previewFor(template: TierTemplate): TierListState {
  const base = createInitialState(template);
  let seed = 2166136261;
  for (const ch of template.slug) seed = ((seed ^ ch.charCodeAt(0)) * 16777619) >>> 0;

  const ids = template.items.map((i) => i.id);
  for (let i = ids.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  // Uneven on purpose - a real board is never a neat rectangle.
  const perRow = [4, 7, 9, 6, 3];
  const placements: Record<string, string[]> = {};
  let cut = 0;
  base.tiers.forEach((tier, i) => {
    const take = perRow[i] ?? 0;
    placements[tier.id] = ids.slice(cut, cut + take);
    cut += take;
  });
  return { ...base, placements, unranked: ids.slice(cut) };
}

// The board, shrunk to card art. The colours ARE the preview.
export function BoardThumb({
  state,
  template,
  size = 13,
  perRow = 9,
}: {
  state: TierListState;
  template: TierTemplate;
  size?: number;
  perRow?: number;
}) {
  const rows = state.tiers.slice(0, 5);
  return (
    <div className="rounded-lg overflow-hidden bg-black">
      {rows.map((tier, i) => {
        const ids = (state.placements[tier.id] ?? []).slice(0, perRow);
        return (
          <div
            key={tier.id}
            className="flex items-stretch"
            style={{ borderTop: i === 0 ? undefined : "1px solid rgba(255,255,255,0.09)" }}
          >
            <span
              className="shrink-0"
              // A plain block, like the board and the share card. The
              // chevron went with them - a thumbnail that still had points
              // on it would not read as a smaller version of the thing it
              // is a thumbnail of.
              style={{ width: size, background: tier.accent }}
            />
            <span
              className="flex-1 min-w-0 flex flex-wrap gap-[3px] p-1 content-start"
              style={{ minHeight: size + 7 }}
            >
              {ids.map((id) => (
                <Mark key={id} item={resolveItem(template, id)} size={size} style={template.itemStyle} />
              ))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// The card art for a CATEGORY, as a crop rather than a shrink.
//
// The whole-board thumbnail above is the right picture for a saved list -
// its shape is what tells one of yours from another - but as the art on
// four category cards it failed at the one job it had. Five bands of
// colour with 13px specks on them look the same whether the specks are
// team logos or players' faces, so a wall of categories read as a wall of
// the same card.
//
// This is the top-left corner of the same board, blown up: two tiers, two
// items each, big enough that a face is a face and a helmet is a helmet.
// The second item runs off the right edge on purpose - a crop that stops
// neatly inside the frame reads as a small board, not as a close-up.
//
// Pass `title` and the art fills the whole card with the name laid over
// it. Below the art, in its own strip, the name was the smallest thing on
// a card whose loudest thing - the board - is the same five colours on
// every category, so the one line that says WHICH category got lost. Over
// the art it is the biggest thing on the card and the art still reads
// through the scrim, which is the trade: the picture says what kind of
// thing this ranks, the words say which.
export function BoardZoom({
  state,
  template,
  title,
}: {
  state: TierListState;
  template: TierTemplate;
  title?: string;
}) {
  const rows = state.tiers.slice(0, 2);
  return (
    <div
      // Square corners when it is the whole card - the card clips to its
      // own radius, and a second smaller one inside it leaves four slivers
      // of the card's background showing through at the corners.
      className={`relative overflow-hidden bg-black ${title ? "" : "rounded-lg"}`}
      // cqw so everything inside scales with the card: these sit in a
      // grid that is two columns on a phone and four on a desktop, and
      // the type has to hold its proportions across both.
      style={{ containerType: "inline-size", aspectRatio: "16 / 12" }}
    >
      {rows.map((tier, i) => {
        const ids = (state.placements[tier.id] ?? []).slice(0, 2);
        const label = tierLabelFor(tier, i);
        return (
          <div
            key={tier.id}
            className="flex h-1/2 items-stretch"
            style={{ borderTop: i === 0 ? undefined : "1px solid rgba(255,255,255,0.09)" }}
          >
            <span
              className="grid shrink-0 place-items-center px-[1cqw] text-center uppercase"
              style={{ width: "26%", background: tier.accent }}
            >
              <span
                style={{
                  ...TIER_LABEL_FONT,
                  lineHeight: TIER_LABEL_LEADING,
                  // A letter gets the full size; a renamed tier shrinks to
                  // fit rather than spilling over the band.
                  fontSize: `min(11cqw, calc(22cqw / ${Math.max(1, label.length * BUNGEE_ADVANCE).toFixed(2)}))`,
                }}
              >
                {label}
              </span>
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-[3.5cqw] pl-[3.5cqw]">
              {ids.map((id) => (
                <ZoomMark key={id} item={resolveItem(template, id)} style={template.itemStyle} />
              ))}
            </span>
          </div>
        );
      })}
      {title && (
        <>
          {/* Heavy where the words are, light where the faces are - one
              flat wash dark enough to read against would have taken the
              team colours out with it, and the colours are why the crop
              is here. The bottom stop is over 1 on purpose: alpha clamps,
              so the last band under the title is solid ground and the
              lettering never has a helmet behind it. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(to top, rgba(3,7,15,1.14) 0%, rgba(3,7,15,0.65) 44%, rgba(3,7,15,0.4) 100%)",
            }}
          />
          <span
            className="absolute inset-x-0 bottom-0 block px-[7%] pb-[6%]"
            style={{
              fontFamily: "var(--font-display)",
              // Bounded at both ends rather than pure cqw: the same card
              // is half a phone screen and a quarter of a desktop row,
              // and a name that scaled freely would be shouting at one
              // size and unreadable at the other.
              fontSize: "clamp(14px, 4.2cqw, 23px)",
              lineHeight: 1.12,
              textWrap: "balance",
              textShadow: "0 2px 10px rgba(0,0,0,0.8)",
            }}
          >
            {title}
          </span>
        </>
      )}
    </div>
  );
}

// One item at card-art size. Drawn the way the board draws it - portraits
// cropped to the top on a team-coloured plate with the surname over the
// shoulders, logos sitting whole - because the point of the crop is that
// it looks like the board you are about to open.
function ZoomMark({ item, style = "mark" }: { item: TierItem; style?: TierItemStyle }) {
  const [failed, setFailed] = useState(false);
  const CHIP = "aspect-square h-[86%] shrink-0";
  if (failed || !item.imageUrl) {
    return (
      <span
        aria-hidden
        className={`${CHIP} rounded-[2cqw]`}
        style={{ background: item.accent, opacity: 0.85 }}
      />
    );
  }
  if (style !== "portrait") {
    return (
      <img
        src={item.imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        crossOrigin="anonymous"
        className={`${CHIP} object-contain`}
        style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.45))" }}
      />
    );
  }
  const name = surname(item.label);
  return (
    <span
      aria-hidden
      className={`${CHIP} relative overflow-hidden rounded-[2cqw]`}
      style={{ background: item.accent }}
    >
      {/* The player's team logo, behind him. ESPN's headshots are cut out
          on transparency, so this shows through - it is most of what
          tells two players on a plate of similar navy apart, and leaving
          it out was the one thing that stopped these reading as the board
          they are a crop of. Same scale and opacity as the chip: bled
          past the corners so it is a texture rather than a sticker, and
          faint enough to stay behind the player. */}
      {item.backdropUrl && (
        <img
          src={item.backdropUrl}
          alt=""
          loading="lazy"
          crossOrigin="anonymous"
          className="absolute max-w-none object-contain"
          style={{
            width: `${BACKDROP_SCALE * 100}%`,
            height: `${BACKDROP_SCALE * 100}%`,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            opacity: BACKDROP_OPACITY,
          }}
        />
      )}
      <img
        src={item.imageUrl}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      <span
        // Wraps rather than clips. At the floor, on the narrowest phone,
        // a two-word surname is a pixel too wide for its chip - and half
        // a name names nobody. Nothing else ever wraps: a name that fits
        // on one line has already been sized to.
        className="absolute inset-x-0 bottom-0 flex items-end justify-center text-center px-[0.5cqw] pb-[0.4cqw] text-white"
        style={{
          fontFamily: "var(--font-display)",
          // The board's own rule, in container units: the chip is 28.8cqw
          // wide (measured, not derived - flex rounding moves it), so 27
          // is the chip minus its padding. Either 0.17 of the chip or the
          // largest size the whole surname still fits, whichever is
          // smaller: a name cut in half names nobody, and this caption
          // exists precisely to tell two faces apart.
          // Floored, because the shrink-to-fit rule alone took the
          // longest surnames to 5px on a two-up phone grid, which is not
          // a caption. At 6px the widest name still clears its chip.
          fontSize: `max(6px, min(5.4cqw, calc(27cqw / ${Math.max(1, name.length * BUNGEE_ADVANCE).toFixed(2)})))`,
          lineHeight: 1.1,
          paddingTop: "7cqw",
          background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.45) 55%, transparent)",
          textShadow: "0 1px 2px rgba(0,0,0,0.9)",
        }}
      >
        {name}
      </span>
    </span>
  );
}
