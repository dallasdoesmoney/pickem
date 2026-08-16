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

// Small corner badge marking which side was picked, used instead of the
// underdog/boldest tag once a game has a real result - after the fact,
// "was I right" matters more than the pre-game tag did.
function PickedBadge({ side }: { side: "left" | "right" }) {
  const positionStyle = { [side === "left" ? "left" : "right"]: "-8px" } as const;
  return (
    <span
      className="absolute -top-2 z-40 h-5 w-5 rounded-full bg-white text-[#0e1b33] text-[10px] flex items-center justify-center font-bold pointer-events-none"
      style={{ ...positionStyle, fontFamily: "var(--font-display)", boxShadow: "0 2px 4px rgba(0,0,0,0.5)" }}
    >
      ★
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

  function outcomeFor(team: TeamAbbr): "win" | "loss" | null {
    if (hasResult) return team === result ? "win" : "loss";
    return picked === team ? "win" : null;
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
        isFaded={!hasResult && hasPick && picked !== away.abbr}
        onClick={() => onPick(away.abbr)}
        disabled={locked}
        badge={
          hasResult ? (
            picked === away.abbr ? (
              <PickedBadge side="left" />
            ) : undefined
          ) : picked === away.abbr && tag ? (
            <TagBadge side="left" tag={tag} />
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
        isFaded={!hasResult && hasPick && picked !== home.abbr}
        onClick={() => onPick(home.abbr)}
        disabled={locked}
        badge={
          hasResult ? (
            picked === home.abbr ? (
              <PickedBadge side="right" />
            ) : undefined
          ) : picked === home.abbr && tag ? (
            <TagBadge side="right" tag={tag} />
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
