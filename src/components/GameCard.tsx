"use client";

import { Game } from "@/data/games";
import { TeamAbbr, TEAMS } from "@/data/teams";
import { PickTag } from "@/lib/pickLayout";
import { PILL_WIDTH, TeamHalfPill } from "@/components/TeamHalfPill";

export { PILL_WIDTH, PILL_HEIGHT } from "@/components/TeamHalfPill";

// Auto-computed tags (underdog/boldest pick) - purely informational, no
// interaction, so this is just a badge rather than a button.
function TagBadge({ side, tag }: { side: "left" | "right"; tag: PickTag }) {
  const positionStyle = { [side === "left" ? "left" : "right"]: "-10px" } as const;
  return (
    <img
      src={tag.icon}
      alt={tag.label}
      className="absolute -top-2.5 z-40 h-[42px] w-auto pointer-events-none"
      style={{
        ...positionStyle,
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
}: {
  side: "left" | "right";
  isLocked: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) {
  const positionStyle = { [side === "left" ? "left" : "right"]: "-10px" } as const;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={isLocked ? "Remove Lock of the Week" : "Mark as Lock of the Week"}
      aria-pressed={isLocked}
      className={`absolute -bottom-2.5 z-40 h-[40px] w-[40px] p-0 border-0 bg-transparent ${disabled ? "cursor-default" : "cursor-pointer"}`}
      style={{ ...positionStyle, transform: `rotate(${side === "left" ? "-18deg" : "18deg"})` }}
    >
      <img
        src="/lock-of-week.png"
        alt=""
        className="h-full w-full object-contain"
        style={{
          filter: isLocked
            ? "drop-shadow(0 0 7px rgba(74,222,128,0.9)) drop-shadow(0 2px 3px rgba(0,0,0,0.6))"
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
  onToggleLock,
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
  onToggleLock?: () => void;
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
    <div className="relative flex items-center mx-auto shrink-0" style={{ width: PILL_WIDTH }}>
      <TeamHalfPill
        team={away}
        side="left"
        outcome={outcomeFor(away.abbr)}
        isFaded={isFadedFor(away.abbr)}
        onClick={() => onPick(away.abbr)}
        disabled={locked}
        badge={
          picked === away.abbr ? (
            <>
              {tag && <TagBadge side="left" tag={tag} />}
              {onToggleLock && <LockBadge side="left" isLocked={!!isLockPick} onToggle={onToggleLock} disabled={locked} />}
            </>
          ) : undefined
        }
        footer={
          <>
            {awaySpread && (
              <span className="text-sm text-white" style={{ fontFamily: "var(--font-display)" }}>
                {awaySpread}
              </span>
            )}
            <span className="text-[10px] text-white/70">{game.awayRecord ?? "0-0"}</span>
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
        badge={
          picked === home.abbr ? (
            <>
              {tag && <TagBadge side="right" tag={tag} />}
              {onToggleLock && <LockBadge side="right" isLocked={!!isLockPick} onToggle={onToggleLock} disabled={locked} />}
            </>
          ) : undefined
        }
        footer={
          <>
            {homeSpread && (
              <span className="text-sm text-white" style={{ fontFamily: "var(--font-display)" }}>
                {homeSpread}
              </span>
            )}
            <span className="text-[10px] text-white/70">{game.homeRecord ?? "0-0"}</span>
          </>
        }
      />
    </div>
  );
}
