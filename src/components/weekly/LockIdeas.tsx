"use client";


import { TEAMS, type TeamAbbr } from "@/data/teams";
import { LOCK_COLOR } from "@/components/TeamHalfPill";
import type { LockPrompt } from "@/components/GameCard";

// FIVE WAYS TO SAY "PICK YOUR LOCK".
//
// The problem, from the session replays: almost nobody sets one. The
// reason is in GameCard - the badge only exists on a game you have
// ALREADY picked, and even then it draws at 45% opacity in greyscale, in
// the bottom corner, under a sticker. Nothing on a fresh board says the
// feature is there, and the KPI pill that would say so shows a dash.
//
// Which matters more than it sounds: a correct pick pays 25 points and a
// correct lock pays 250 on top. The one control nobody can find is worth
// ten times every other click on the page. That number is the argument
// every variant below is really making.
//
// Each of these is a real control, not a picture of one. They differ in
// WHERE the choice happens:
//
//   nudge    on the board, with the KPI pill pointing at it
//   loud     on the board, with the badge no longer hiding
//   mode     on the board, but only after the pill turns the board into
//            a chooser
//   picker   in the pill - never touch the board
//   banner   in a strip of its own between the two

export type IdeaKey = "nudge" | "loud" | "mode" | "picker" | "banner";

export const IDEAS: { key: IdeaKey; name: string; note: string }[] = [
  {
    key: "nudge",
    name: "1 · Nudge the pill",
    note: "Your idea, and the smallest change on this page. The dash becomes a padlock and a TAP A PICK caption, and the pill breathes until a lock is set. Nothing on the board changes, so it costs no space and cannot break the grid - but it still asks people to go find a badge they have never noticed.",
  },
  {
    key: "loud",
    name: "2 · Stop hiding the badge",
    note: "No new furniture at all - the badge just stops whispering. Full colour instead of 45% grey, half again as big, a LOCK? tag under it, breathing. It is on every pick you have made until you choose one, then only on that one. The fix closest to the actual bug.",
  },
  {
    key: "mode",
    name: "3 · Lock mode",
    note: "The pill becomes a button. Press it and the board turns into a chooser: everything you have not picked dims out, every pick you have made lights its padlock, and a bar tells you what to do. One tap ends it. The clearest of the five, and the only one that adds a state to the page.",
  },
  {
    key: "picker",
    name: "4 · Choose inside the pill",
    note: "The board never enters into it. The pill unrolls into the teams you have already picked; tap one and it is your lock. Nobody has to know the badge exists. The catch is the row gets long in a full week - it scrolls, which is a worse tap target than a card.",
  },
  {
    key: "banner",
    name: "5 · A line that says the number",
    note: "A strip between the board and the pills that says the part nobody knows: a lock that hits is worth 250 points, ten normal picks. Then a button that runs lock mode. The only variant that explains WHY rather than just where, and the only one you can dismiss.",
  },
];

// ------------------------------------------------------------- pieces

// The centre KPI pill, at the size the real board draws it. Copied to
// this file rather than imported because it is what four of the five
// variants are changing - the real one keeps its shape until one of
// these wins, and then this is the diff.
export function LockPill({
  lockedTeam,
  children,
  onClick,
  halo,
  wide,
}: {
  lockedTeam?: (typeof TEAMS)[TeamAbbr] | null;
  children: React.ReactNode;
  onClick?: () => void;
  halo?: boolean;
  wide?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative shrink-0 rounded-full border-2 text-center flex flex-col items-center justify-center ${halo ? "lock-halo" : ""} ${onClick ? "cursor-pointer transition-transform active:scale-95" : ""}`}
      style={{
        background: lockedTeam ? lockedTeam.color : "#1b2947",
        borderColor: LOCK_COLOR,
        width: wide ? 300 : 250,
        height: 88,
      }}
    >
      <img
        src="/lock-of-week.png"
        alt=""
        className="absolute w-auto rotate-[-18deg] drop-shadow-[0_3px_4px_rgba(0,0,0,0.6)] z-10"
        style={{ top: -12, left: -6, height: 64 }}
      />
      {children}
    </Tag>
  );
}

const LABEL = { fontSize: 11, marginTop: 2 } as const;

export function PillLabel({ children = "LOCK OF THE WEEK" }: { children?: React.ReactNode }) {
  return (
    <div className="relative z-10 text-white/55" style={LABEL}>
      {children}
    </div>
  );
}

// The set state, identical in every variant: the team's logo. Only the
// EMPTY state is what these five disagree about.
export function LockedValue({ team }: { team: (typeof TEAMS)[TeamAbbr] }) {
  return (
    <>
      <div className="relative z-10 flex items-center justify-center">
        <img src={team.logo} alt="" crossOrigin="anonymous" className="w-auto" style={{ height: 64 }} />
      </div>
      <PillLabel />
    </>
  );
}

// ------------------------------------------------------------- the five

// What a variant needs from the board around it. The scratch page owns
// the picks and the lock; a variant only decides how the empty state
// looks and what the board does while it is empty.
export type IdeaState = {
  picks: Record<string, TeamAbbr>;
  lockedGameId: string | null;
  setLock: (gameId: string | null) => void;
  // gameId -> the team picked in it, in board order. What the picker
  // variant unrolls and what lock mode lights up.
  picked: { gameId: string; team: (typeof TEAMS)[TeamAbbr] }[];
};

// How the board draws while a variant is running.
export type BoardMode = {
  lockPrompt: LockPrompt;
  // Dim everything that is not a pick - lock mode only.
  choosing: boolean;
};

export function boardModeFor(key: IdeaKey, choosing: boolean, hasLock: boolean): BoardMode {
  if (key === "loud") return { lockPrompt: hasLock ? "ghost" : "loud", choosing: false };
  if (key === "mode" || key === "banner") return { lockPrompt: choosing && !hasLock ? "loud" : hasLock ? "ghost" : "hidden", choosing: choosing && !hasLock };
  if (key === "picker") return { lockPrompt: "hidden", choosing: false };
  return { lockPrompt: "ghost", choosing: false };
}

// ---- 1. Nudge -------------------------------------------------------

export function NudgePill({ state }: { state: IdeaState }) {
  const team = state.lockedGameId ? TEAMS[state.picks[state.lockedGameId]] : null;
  if (team) return <LockPill lockedTeam={team}><LockedValue team={team} /></LockPill>;
  return (
    <LockPill halo>
      <div className="relative z-10 flex items-center justify-center gap-2" style={{ fontFamily: "var(--font-display)", fontSize: 18, color: LOCK_COLOR }}>
        <TapIcon />
        TAP A PICK
      </div>
      <PillLabel />
    </LockPill>
  );
}

// A hand rather than an arrow: an arrow has to point somewhere, and the
// badge it would point at is off in a corner that moves with the grid.
function TapIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11.5V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-4-2l-2.2-3a1.5 1.5 0 0 1 2.3-1.9L9 15V8.5a1.5 1.5 0 0 1 3 0" />
    </svg>
  );
}

// ---- 2. Loud badge --------------------------------------------------

// The pill says nothing new here - the whole argument is on the board.
export function LoudPill({ state }: { state: IdeaState }) {
  const team = state.lockedGameId ? TEAMS[state.picks[state.lockedGameId]] : null;
  if (team) return <LockPill lockedTeam={team}><LockedValue team={team} /></LockPill>;
  return (
    <LockPill>
      <div className="relative z-10" style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "#4ade80" }}>
        -
      </div>
      <PillLabel />
    </LockPill>
  );
}

// ---- 3. Lock mode ---------------------------------------------------

export function ModePill({ state, choosing, setChoosing }: { state: IdeaState; choosing: boolean; setChoosing: (v: boolean) => void }) {
  const team = state.lockedGameId ? TEAMS[state.picks[state.lockedGameId]] : null;
  if (team) {
    return (
      <LockPill lockedTeam={team} onClick={() => state.setLock(null)}>
        <LockedValue team={team} />
      </LockPill>
    );
  }
  return (
    <LockPill halo={!choosing} onClick={() => setChoosing(!choosing)}>
      <div className="relative z-10 flex items-center gap-2" style={{ fontFamily: "var(--font-display)", fontSize: 19, color: LOCK_COLOR }}>
        {choosing ? "CANCEL" : "SET YOUR LOCK"}
        {!choosing && <span style={{ fontSize: 16 }}>&rarr;</span>}
      </div>
      <PillLabel />
    </LockPill>
  );
}

// The instruction, while the board is a chooser. Above the grid rather
// than below it, because the thing it is talking about is the grid.
export function ChoosingBar({ count }: { count: number }) {
  return (
    <div
      className="mx-auto mb-3 flex max-w-xl items-center justify-center gap-2 rounded-full px-4 py-2 text-center"
      style={{ background: "rgba(245,158,11,0.14)", border: `1px solid ${LOCK_COLOR}`, color: "#fde3a7", fontSize: 13 }}
    >
      <img src="/lock-of-week.png" alt="" className="h-6 w-auto" />
      {count === 0 ? "Make a pick first - your lock has to be one of them." : "Tap the pick you are most confident in."}
    </div>
  );
}

// ---- 4. Picker in the pill ------------------------------------------

export function PickerPill({ state }: { state: IdeaState }) {
  const team = state.lockedGameId ? TEAMS[state.picks[state.lockedGameId]] : null;
  if (team) {
    return (
      <LockPill lockedTeam={team} onClick={() => state.setLock(null)}>
        <LockedValue team={team} />
      </LockPill>
    );
  }
  return (
    <LockPill wide>
      {state.picked.length === 0 ? (
        <>
          <div className="relative z-10" style={{ fontFamily: "var(--font-display)", fontSize: 15, color: LOCK_COLOR }}>
            MAKE A PICK FIRST
          </div>
          <PillLabel />
        </>
      ) : (
        <>
          {/* pl-12 keeps the row clear of the padlock hanging off the
              corner, which otherwise sits on top of the first logo. */}
          <div className="relative z-10 flex w-full items-center gap-1 overflow-x-auto pl-12 pr-3" style={{ scrollbarWidth: "none" }}>
            {state.picked.map(({ gameId, team: t }) => (
              <button
                key={gameId}
                type="button"
                onClick={() => state.setLock(gameId)}
                className="shrink-0 rounded-full p-1 transition-transform hover:scale-110 active:scale-95"
                style={{ background: "rgba(0,0,0,0.25)" }}
                aria-label={`Lock ${t.name}`}
              >
                <img src={t.logo} alt="" crossOrigin="anonymous" className="w-auto" style={{ height: 34 }} />
              </button>
            ))}
          </div>
          <PillLabel>TAP ONE TO LOCK</PillLabel>
        </>
      )}
    </LockPill>
  );
}

// ---- 5. Banner ------------------------------------------------------

export function LockBanner({ onChoose, choosing, onDismiss }: { onChoose: () => void; choosing: boolean; onDismiss: () => void }) {
  return (
    <div
      className="mx-auto flex w-full max-w-2xl items-center gap-3 rounded-2xl px-4 py-3"
      style={{ background: "rgba(245,158,11,0.12)", border: `1px solid rgba(245,158,11,0.55)` }}
    >
      <img src="/lock-of-week.png" alt="" className="h-10 w-auto shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]" />
      <div className="min-w-0 flex-1 text-left">
        <div style={{ fontFamily: "var(--font-display)", fontSize: 15, color: "#fde3a7" }}>YOU HAVE NO LOCK OF THE WEEK</div>
        {/* The number is the whole point of this variant. 25 and 250 are
            what the database actually pays - see sync_lock_bonus. */}
        <div className="text-[12.5px] leading-snug text-white/60">
          One pick you are sure about. It pays <span className="text-[#fde3a7]">250 points</span> if it hits &mdash; ten times a normal pick.
        </div>
      </div>
      <button
        type="button"
        onClick={onChoose}
        className={`shrink-0 rounded-full px-4 py-2 transition-transform active:scale-95 ${choosing ? "" : "lock-halo"}`}
        style={{ fontFamily: "var(--font-display)", fontSize: 13, background: LOCK_COLOR, color: "#0e1b33" }}
      >
        {choosing ? "CANCEL" : "CHOOSE"}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-full px-2 py-1 text-white/40 transition-colors hover:text-white/80"
      >
        &times;
      </button>
    </div>
  );
}

export function BannerPill({ state }: { state: IdeaState }) {
  return <LoudPill state={state} />;
}
