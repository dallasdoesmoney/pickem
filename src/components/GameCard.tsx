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
    <span
      role="img"
      aria-label={tag.label}
      className="absolute -top-2.5 z-40 text-[42px] leading-none pointer-events-none"
      style={{
        ...positionStyle,
        transform: `rotate(${side === "left" ? "-22deg" : "22deg"})`,
        filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.6))",
      }}
    >
      {tag.emoji}
    </span>
  );
}

export function GameCard({
  game,
  picked,
  onPick,
  tag,
  result,
  locked,
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  tag?: PickTag;
  result?: TeamAbbr;
  locked?: boolean;
}) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];
  const hasPick = !!picked;
  const hasResult = !!result;

  // Only the side you picked ever gets a verdict - green W if it matches
  // the real result, red L if it doesn't. Same pattern as the team
  // predictor's tracked-team highlight, just pointed at "were you right"
  // instead of "who are you rooting for."
  function outcomeFor(team: TeamAbbr): "win" | "loss" | null {
    if (team !== picked) return null;
    if (hasResult) return picked === result ? "win" : "loss";
    return "win";
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
        isFaded={hasPick && picked !== away.abbr}
        onClick={() => onPick(away.abbr)}
        disabled={locked}
        badge={picked === away.abbr && tag ? <TagBadge side="left" tag={tag} /> : undefined}
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
        isFaded={hasPick && picked !== home.abbr}
        onClick={() => onPick(home.abbr)}
        disabled={locked}
        badge={picked === home.abbr && tag ? <TagBadge side="right" tag={tag} /> : undefined}
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
