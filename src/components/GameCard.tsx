"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";
import { PickTag } from "@/lib/pickLayout";
import { PILL_WIDTH, TeamHalfPill } from "@/components/TeamHalfPill";

export { PILL_WIDTH, PILL_HEIGHT } from "@/components/TeamHalfPill";

// Shared with the desktop grid's own track sizing (weekly/page.tsx) -
// CSS Grid's `1fr` columns don't shrink just because the content inside
// them does, so the grid needs to compute its own track width from this
// same constant rather than relying on the card shrinking "naturally."
export const COMPACT_SCALE = 0.85;

// Auto-computed tags (underdog/boldest pick) - purely informational, no
// interaction, so this is just a badge rather than a button.
function TagBadge({ side, tag, scale = 1 }: { side: "left" | "right"; tag: PickTag; scale?: number }) {
  const offset = 10 * scale;
  const positionStyle = { [side === "left" ? "left" : "right"]: `-${offset}px` } as const;
  return (
    <img
      src={tag.icon}
      alt={tag.label}
      className="absolute z-40 w-auto pointer-events-none"
      style={{
        ...positionStyle,
        top: `-${offset}px`,
        height: 50 * scale,
        transform: `rotate(${side === "left" ? "-22deg" : "22deg"})`,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
      }}
    />
  );
}

// Bottom corner (TagBadge already owns the top corner) so an underdog/
// boldest-pick sticker and a lock can both show on the same pick. Ghost
// (dim + grayscale) on any pick that isn't locked yet - same spot every
// time, so it's a discoverable, always-visible tap target rather than
// something that only appears once you've already used it. Filled in
// with a green glow once it is the lock.
function LockBadge({
  side,
  isLocked,
  onToggle,
  disabled,
  scale = 1,
}: {
  side: "left" | "right";
  isLocked: boolean;
  onToggle: () => void;
  disabled?: boolean;
  scale?: number;
}) {
  const offset = 10 * scale;
  const size = 40 * scale;
  const positionStyle = { [side === "left" ? "left" : "right"]: `-${offset}px` } as const;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={isLocked ? "Remove Lock of the Week" : "Mark as Lock of the Week"}
      aria-pressed={isLocked}
      className={`absolute z-40 p-0 border-0 bg-transparent ${disabled ? "cursor-default" : "cursor-pointer"}`}
      style={{ ...positionStyle, bottom: `-${offset}px`, height: size, width: size, transform: `rotate(${side === "left" ? "-18deg" : "18deg"})` }}
    >
      <img
        src="/lock-of-week.png"
        alt=""
        className="h-full w-full object-contain"
        style={{
          filter: isLocked
            ? "drop-shadow(0 0 7px rgba(245,158,11,0.9)) drop-shadow(0 2px 3px rgba(0,0,0,0.6))"
            : "grayscale(1) drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
          opacity: isLocked ? 1 : 0.45,
        }}
      />
    </button>
  );
}

export function GameCard({
  game,
  picked,
  onPick,
  tag,
  result,
  locked,
  isLockPick,
  hasLock,
  onToggleLock,
  scale = 1,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  tag?: PickTag;
  result?: TeamAbbr;
  locked?: boolean;
  // "Lock of the Week" (your one confident pick) - unrelated to `locked`
  // above (that one means "the week is closed for editing"). Both left
  // undefined on pages that don't have this feature (the predictor).
  isLockPick?: boolean;
  // Whether ANY game this week is currently locked (not just this one) -
  // the discoverable ghost badge only makes sense before a lock exists;
  // once one is set, every other game's ghost badge disappears rather
  // than staying visible-but-pointless, and comes back the moment the
  // lock is cleared.
  hasLock?: boolean;
  onToggleLock?: () => void;
  // Uniform shrink for the two-column grid, which now runs at every
  // viewport width (not just desktop) - the grid computes this from the
  // actual available column width so two cards always fit side by side,
  // down to the smallest phone. Defaults to 1 (full size) for any other
  // caller.
  scale?: number;
}) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];
  const hasResult = !!result;

  // Whichever side matters visually - your pick if you made one, or the
  // real winner if you didn't (e.g. viewing results signed out) - stays
  // full brightness; the other side dims. Only the picked team ever gets
  // a personal verdict (green W if it matches the result, red L if not,
  // same pattern as the team predictor's tracked-team highlight); with
  // no pick to judge, it falls back to plainly marking who won.
  const highlighted = picked ?? (hasResult ? result : undefined);

  function outcomeFor(team: TeamAbbr): "win" | "loss" | null {
    if (team !== highlighted) return null;
    if (!hasResult) return "win";
    if (!picked) return "win";
    return picked === result ? "win" : "loss";
  }

  function isFadedFor(team: TeamAbbr): boolean {
    return highlighted !== undefined && team !== highlighted;
  }

  const awaySpread =
    game.favorite && game.spread !== undefined
      ? game.favorite === game.away
        ? `-${game.spread}`
        : `+${game.spread}`
      : undefined;
  const homeSpread =
    game.favorite && game.spread !== undefined
      ? game.favorite === game.home
        ? `-${game.spread}`
        : `+${game.spread}`
      : undefined;

  return (
    // No isolate here - a suspicious-pick/tag badge needs to escape this
    // card's own box (it scales up huge) and render above EVERY other
    // card on the page, not just within a locally-scoped stacking
    // context. That's safe now that the sticky header (NavShell) sits at
    // z-50, above every in-card z-index (badge z-40, border z-30, label
    // z-20) - see NavShell.tsx for the other half of this.
    <div className="relative flex items-center mx-auto shrink-0" style={{ width: PILL_WIDTH * scale }}>
      <TeamHalfPill
        team={away}
        side="left"
        outcome={outcomeFor(away.abbr)}
        isFaded={isFadedFor(away.abbr)}
        onClick={() => onPick(away.abbr)}
        disabled={locked}
        isLockPick={picked === away.abbr && isLockPick && !hasResult}
        scale={scale}
        badge={
          picked === away.abbr ? (
            <>
              {tag && <TagBadge side="left" tag={tag} scale={scale} />}
              {onToggleLock && (isLockPick || !hasLock) && <LockBadge side="left" isLocked={!!isLockPick} onToggle={onToggleLock} disabled={locked} scale={scale} />}
            </>
          ) : undefined
        }
        footer={
          <>
            {awaySpread && (
              <span className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: 14 * scale }}>
                {awaySpread}
              </span>
            )}
            <span className="text-white/70" style={{ fontSize: 10 * scale }}>{game.awayRecord ?? "0-0"}</span>
          </>
        }
      />
      <TeamHalfPill
        team={home}
        side="right"
        outcome={outcomeFor(home.abbr)}
        isFaded={isFadedFor(home.abbr)}
        onClick={() => onPick(home.abbr)}
        disabled={locked}
        isLockPick={picked === home.abbr && isLockPick && !hasResult}
        scale={scale}
        badge={
          picked === home.abbr ? (
            <>
              {tag && <TagBadge side="right" tag={tag} scale={scale} />}
              {onToggleLock && (isLockPick || !hasLock) && <LockBadge side="right" isLocked={!!isLockPick} onToggle={onToggleLock} disabled={locked} scale={scale} />}
            </>
          ) : undefined
        }
        footer={
          <>
            {homeSpread && (
              <span className="text-white" style={{ fontFamily: "var(--font-display)", fontSize: 14 * scale }}>
                {homeSpread}
              </span>
            )}
            <span className="text-white/70" style={{ fontSize: 10 * scale }}>{game.homeRecord ?? "0-0"}</span>
          </>
        }
      />
    </div>
  );
}
