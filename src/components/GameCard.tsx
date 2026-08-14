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
}: {
  game: Game;
  picked?: TeamAbbr;
  onPick: (team: TeamAbbr) => void;
  tag?: PickTag;
}) {
  const away = TEAMS[game.away];
  const home = TEAMS[game.home];
  const hasPick = !!picked;

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
    <div className="relative isolate flex items-center mx-auto shrink-0" style={{ width: PILL_WIDTH }}>
      <TeamHalfPill
        team={away}
        side="left"
        outcome={picked === away.abbr ? "win" : null}
        isFaded={hasPick && picked !== away.abbr}
        onClick={() => onPick(away.abbr)}
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
        outcome={picked === home.abbr ? "win" : null}
        isFaded={hasPick && picked !== home.abbr}
        onClick={() => onPick(home.abbr)}
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
