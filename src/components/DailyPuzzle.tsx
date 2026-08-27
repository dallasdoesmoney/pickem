"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import posthog from "posthog-js";
import { PUZZLE_PLAYERS, PUZZLE_PLAYERS_BY_ID, PuzzlePlayer } from "@/data/puzzlePlayers";
import { TEAMS, TeamAbbr } from "@/data/teams";
import { teamTile } from "@/lib/colorUtils";
import { PlayerFace } from "@/components/PlayerFace";
import { PlayerPlate } from "@/components/PlayerPlate";
import {
  fetchDailyPuzzle,
  submitDailyGuess,
  submitGuestGuess,
  readGuestGuesses,
  writeGuestGuesses,
  clearGuestGuesses,
  puzzleToday,
  PuzzleState,
  PuzzleGuess,
  Verdict,
  NumCell,
} from "@/lib/supabase/dailyPuzzle";
import { errorMessage } from "@/lib/errorMessage";
import { buildReferralLinkTo } from "@/lib/referralStorage";
import { useAuth } from "@/hooks/useAuth";
import { StillBrewingModal } from "@/components/StillBrewingModal";

// The sticker language, in one place - moved down the scale. Same four
// rules as the cream board it replaces (solid ground, hard outline, hard
// offset shadow, no transparency), with one thing kept deliberately: the
// CARD IS LIGHTER THAN THE PAGE. That is what makes an offset shadow read
// as depth on a dark ground instead of as a smudge, and it is the whole
// trick behind this palette.
//
// The chips stay light, so black type on them survives the change - the
// board is dark, the stickers on it are not.
const CARD = "#141d31";
const FIELD = "#0e1626";
const RULE = "#2b3a56";
const TEXT = "#eef3fb";
const MUTED = "#7d8ca6";
const ALARM = "#ff6f61";
// Ink is the colour of type ON A CHIP, and only that. Everything written
// on the card itself uses TEXT.
const INK = "#0a1020";
const EDGE = `2px solid #0a1120`;
// The card sits on the page, so it gets an ambient shadow; the chips sit
// on the card, so they keep the hard offset. Two different jobs that were
// one constant when everything was cream.
const CARD_EDGE = `1px solid ${RULE}`;
const DROP = `0 24px 60px -22px #000000`;

// Columns, in board order. `base` marks the three that come from the team
// a player is on, so they are known for everybody. The rest depend on
// roster fields ESPN does not publish for everyone; a column nothing knows
// a value for is hidden rather than drawn as a row of "?", which tells you
// nothing and costs width.
const COLUMNS = [
  { key: "team", label: "TEAM", base: true },
  { key: "division", label: "DIV", base: true },
  { key: "position", label: "POS", base: true },
  { key: "age", label: "AGE", base: false },
  { key: "height", label: "HT", base: false },
  // WEIGHT is off the board for now. The server still grades it - see
  // puzzle_num('weight', ...) in the migrations - and the value still
  // arrives on every guess, so putting it back is this one line and no
  // SQL. Nothing else has to change.
  { key: "jersey", label: "#", base: false },
  { key: "college", label: "COLLEGE", base: false },
] as const;

type ColumnKey = (typeof COLUMNS)[number]["key"];

function cellOf(guess: PuzzleGuess, key: ColumnKey) {
  return guess[key] as { value: string | number | null; status: Verdict; direction?: NumCell["direction"] };
}

// Height reads as feet and inches or it does not read at all.
function formatCell(key: ColumnKey, value: string | number | null): string {
  if (value === null || value === undefined) return "?";
  if (key === "height" && typeof value === "number") return `${Math.floor(value / 12)}'${value % 12}"`;
  return String(value);
}

// Black ink on every one of them, including the misses. A greyed-out
// value in a grey chip says "ignore me" twice, and the value is the part
// you are reading the board for - you need to know it was MIA even when
// MIA is wrong. The colour carries the verdict; the text carries the
// fact. Against black: 9.0:1 on the green, 12.8 on the gold, 9.0 on the
// grey, all clear of AA - which is the reason the chips stayed light
// when the board went dark.
//
// The miss grey is the one that has been got wrong twice. On the cream
// board it was a cream, which was right there. Ported straight down the
// scale it became a navy DARKER than the card behind it - 1.29:1, which
// is not a chip, it is a hole in the row.
//
// The ceiling is that a miss must never be LOUDER than a hit. This grey
// is 7.9:1 against the card and the green is 8.0, so it sits a hair
// under, which is as bright as a wrong answer is allowed to get.
// `unknown` is a step quieter again: "nobody has this value" is less
// than a miss, not more.
const TONE: Record<Verdict, { bg: string; ink: string }> = {
  hit: { bg: "#3ecb78", ink: INK },
  close: { bg: "#ffce3a", ink: INK },
  miss: { bg: "#aab3c1", ink: INK },
  unknown: { bg: "#8d96a5", ink: INK },
};

// What a yellow in each column actually means, which is worth saying out
// loud now that more than the numbers can produce one. Drives the legend.
//
// POS is deliberately absent: it has no close any more. Grouping corners
// with safeties barely narrowed a pool where a quarter of the league is a
// defensive back, and a yellow that does not narrow anything teaches
// people to ignore yellow.
const CLOSE_MEANS: Partial<Record<ColumnKey, string>> = {
  division: "same conference",
  college: "same college conference",
  age: "within 3 years",
  height: "within 2 inches",
  jersey: "within 3",
};

// Every column, one colour language. A correct TEAM cell used to take
// that team's own colour, on the theory that Ravens purple and Chiefs red
// are different facts where two greens are the same fact twice.
//
// It was the wrong call. The board teaches exactly three colours in its
// own legend - green right, gold close, grey wrong - and then broke that
// promise in the first column, where a correct Ravens guess came back
// purple. Somebody who has played twice reads purple as a fourth verdict
// they have not learned yet, and the only way to find out it means "right"
// is to already know it. A rule with one exception is two rules.
function cellStyle(_key: ColumnKey, cell: { value: string | number | null; status: Verdict }) {
  const tone = TONE[cell.status];
  return { bg: tone.bg, ink: tone.ink };
}

// A guest's board in the server's own shape, so every renderer below is
// unaware there are two kinds of player.
//
// `answer` is the one field that cannot be filled in honestly. A guest
// who SOLVES it knows the answer - it is the guess they just made - so
// the reveal is theirs. A guest who runs out does not get told, because
// the only way to tell them is an endpoint that hands the day's answer to
// anybody who asks, and that is a spoiler API rather than a feature.
function guestBoard(puzzleOn: string, guesses: PuzzleGuess[]): PuzzleState {
  const max = 8;
  const solved = guesses.some((g) => g.correct);
  const won = solved ? guesses.find((g) => g.correct)! : null;
  return {
    puzzleOn,
    maxGuesses: max,
    guessesUsed: guesses.length,
    guesses,
    solved,
    finished: solved || guesses.length >= max,
    // Nothing is paid to a board nobody is keeping.
    pointsAwarded: 0,
    answer: won
      ? {
          espnId: won.espnId,
          name: won.name,
          team: won.team.value,
          position: won.position.value,
        }
      : null,
  };
}

export function DailyPuzzle({ header }: { header?: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [state, setState] = useState<PuzzleState | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // How many guesses in before the sign-up prompt appears. Three is
  // enough to have seen what the game is and to have something to lose,
  // and early enough that the ask is not arriving at the door on the way
  // out.
  const PROMPT_AT = 3;
  const [prompted, setPrompted] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // THE WIN IS HELD. Solving used to swap the reveal card in on the same
  // tick the guess landed, so the board turned green and vanished in the
  // same frame and you never saw the thing you had just done. For these
  // 2.15 seconds the reveal does not exist yet: the row turns over one
  // chip at a time, the rest of the board dims, and only then does the
  // page move.
  //
  // It is set from the guess handler and nowhere else, which is what
  // keeps a refresh from replaying it - come back to a solved board and
  // there is no celebration, because there was no guess.
  const CELEBRATE_MS = 2150;
  const [celebrating, setCelebrating] = useState(false);
  const celebrateTimer = useRef<number | null>(null);
  const revealRef = useRef<HTMLDivElement>(null);

  const endCelebration = useCallback(() => {
    if (celebrateTimer.current !== null) {
      window.clearTimeout(celebrateTimer.current);
      celebrateTimer.current = null;
    }
    setCelebrating(false);
    // The reveal only mounts once celebrating is false, so the scroll has
    // to wait a frame for something to scroll to.
    window.setTimeout(() => {
      revealRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }, []);

  // Any tap or key cuts it short. Somebody on their fourth day does not
  // want to watch this again, and an animation you cannot get out of
  // stops being a reward on about the third viewing.
  useEffect(() => {
    if (!celebrating) return;
    const skip = () => endCelebration();
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [celebrating, endCelebration]);

  useEffect(() => () => {
    if (celebrateTimer.current !== null) window.clearTimeout(celebrateTimer.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Signed in: the server holds the board, as it always has - it is the
    // only copy that can be trusted with a guess limit and a payout.
    if (user) {
      fetchDailyPuzzle()
        .then((next) => {
          if (cancelled) return;
          setState(next);
          // Anything played as a guest today is handed over on the way
          // in, one guess at a time through the real function, so it
          // lands with the limit and the points applied properly rather
          // than being trusted wholesale.
          const held = readGuestGuesses(next.puzzleOn).filter(
            (g) => !next.guesses.some((existing) => existing.espnId === g.espnId)
          );
          clearGuestGuesses();
          if (!held.length) return;
          void (async () => {
            let board = next;
            for (const g of held) {
              if (board.finished) break;
              try {
                board = await submitDailyGuess(g.espnId);
              } catch {
                // A guess the server refuses (already used, day over)
                // stops the handover rather than failing the page - the
                // board it has is still the true one.
                break;
              }
            }
            if (!cancelled) setState(board);
          })();
        })
        .catch((err) => !cancelled && setError(errorMessage(err)));
      return () => {
        cancelled = true;
      };
    }
    // Signed out: the browser holds it. Nothing is recorded, nothing is
    // paid, and it survives a reload but not a new device.
    const on = puzzleToday();
    // Reading browser storage after mount is the point of this branch.
    // Doing it in the state initialiser would have the server render an
    // empty board and the client render a played one off the same HTML,
    // which is a hydration mismatch. Same trade the tier list's saved
    // view makes, for the same reason.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(guestBoard(on, readGuestGuesses(on)));
    return () => {
      cancelled = true;
    };
  }, [user]);

  const guessedIds = useMemo(() => new Set(state?.guesses.map((g) => g.espnId) ?? []), [state]);

  const visibleColumns = useMemo(() => {
    const guesses = state?.guesses ?? [];
    return COLUMNS.filter((c) => c.base || guesses.some((g) => cellOf(g, c.key).status !== "unknown"));
  }, [state]);

  // Fixed player column, hint columns share the remainder. Nothing here
  // has a minimum width, which is the whole reason the board can no
  // longer push a scrollbar out the side of its card.
  const columnTrack = `var(--puzzle-player-col) repeat(${visibleColumns.length}, minmax(0, 1fr))`;

  // Someone typing "jam" wants Jameson before Benjamin. Starts-with wins,
  // then contains, and the tie inside each is alphabetical because the
  // list is already sorted that way.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const starts: PuzzlePlayer[] = [];
    const contains: PuzzlePlayer[] = [];
    for (const p of PUZZLE_PLAYERS) {
      const name = p.name.toLowerCase();
      if (name.startsWith(q)) starts.push(p);
      else if (name.includes(q)) contains.push(p);
      if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
  }, [query]);

  useEffect(() => {
    menuRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active]);

  async function guess(player: PuzzlePlayer) {
    if (busy || guessedIds.has(player.espnId)) return;
    setError(null);
    setBusy(true);
    try {
      let next: PuzzleState;
      if (user) {
        next = await submitDailyGuess(player.espnId);
      } else {
        // Graded by the server, held by the browser. The limit is
        // enforced here rather than there, which is fine precisely
        // because nothing a guest does is recorded - the worst somebody
        // can cheat themselves out of is the surprise.
        const graded = await submitGuestGuess(player.espnId);
        const held = [...(state?.guesses ?? []), graded];
        writeGuestGuesses(state?.puzzleOn ?? puzzleToday(), held);
        next = guestBoard(state?.puzzleOn ?? puzzleToday(), held);
      }
      setState(next);
      setQuery("");
      // A solve that happened just now, on this guess - which is the only
      // kind that gets the celebration. Anybody who reduces motion goes
      // straight to the reveal.
      if (next.solved && !state?.solved) {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          window.setTimeout(() => {
            revealRef.current?.scrollIntoView({ block: "start" });
          }, 40);
        } else {
          setCelebrating(true);
          celebrateTimer.current = window.setTimeout(endCelebration, CELEBRATE_MS);
        }
      }
      // The ask, once, at the third guess - and never to somebody who
      // already has an account.
      if (!user && next.guessesUsed >= PROMPT_AT && !next.finished && !prompted) {
        setPrompted(true);
        setShowJoin(true);
        posthog.capture("daily_puzzle_join_prompted", { used: next.guessesUsed });
      }
      posthog.capture("daily_puzzle_guess", { used: next.guessesUsed, solved: next.solved, guest: !user });
      inputRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // Arrow keys and enter, because a name you have already typed most of
  // should not need the mouse to finish.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!matches.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = matches[active];
      if (pick && !guessedIds.has(pick.espnId)) guess(pick);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  }

  // The share grid is why games like this travel, and it deliberately
  // carries NO name, team or position - only squares, the date and the
  // score. A result you cannot post without spoiling the day for whoever
  // reads it does not get posted.
  // The link a result carries. Points at the game itself rather than the
  // front door, and carries the sharer's referral code so a share that
  // becomes a signup is credited - the same code the invite card uses,
  // just aimed somewhere useful.
  //
  // Built at share time rather than held in state: it needs `window`,
  // which is not there when this renders on the server, and it is wanted
  // exactly once - at the moment somebody taps the button.
  // Pulled out of shareText because the reveal card shows it too. Nobody
  // should have to tap Share to find out what Share is going to post -
  // the grid is the part people are actually deciding whether to send,
  // and it gives away the board's shape without giving away the player.
  function shareGrid(s: PuzzleState): string {
    return s.guesses
      .map((g) =>
        visibleColumns
          .map((c) => {
            const st = cellOf(g, c.key).status;
            return st === "hit" ? "🟩" : st === "close" ? "🟨" : "⬜";
          })
          .join("")
      )
      .join("\n");
  }

  // The body WITHOUT the link on the end. The share sheet takes the link
  // as its own field and appends it itself, so a copy pasted in here as
  // well arrives twice - once as a line of text and once as the attached
  // URL. The clipboard path, which has no url field, adds it back.
  function shareBody(s: PuzzleState): string {
    const grid = shareGrid(s);
    // Words, not a fraction. "4/8" reads as four out of eight RIGHT - a
    // score on a test - which is the opposite of what it means: it took
    // four guesses out of the eight you were allowed, and fewer is
    // better. Wordle can get away with 4/6 because everybody already
    // knows the convention; nobody knows this one yet, and the share is
    // the one place the result is read by people who have never played.
    //
    // Same words as the reveal card, so what you shared is what you saw.
    const score = s.solved ? `Solved in ${s.guessesUsed}` : "Out of guesses";
    return `Sideline Brew \u2014 Nameplate\n${s.puzzleOn}  ${score}\n\n${grid}`;
  }

  async function share() {
    if (!state) return;
    // Absolute, and carrying the sharer's referral code when there is one
    // to carry - buildReferralLinkTo returns origin + /daily, plus
    // ?ref=username for anybody signed in. A signed-out player shares the
    // same link without the code, because there is no account to credit.
    const dailyLink = buildReferralLinkTo("/daily", profile?.username);
    const body = shareBody(state);
    if (navigator.share) {
      try {
        // No title. Messages ignores it, and the ones that do use it put
        // it above a body that already opens with the same two words.
        //
        // url as its own field rather than pasted on the end of text: a
        // share sheet will only unfurl something it has been TOLD is a
        // URL, and it appends it to the message itself - so the body
        // deliberately stops at the grid.
        await navigator.share({ text: body, url: dailyLink });
        posthog.capture("daily_puzzle_shared", { method: "native_share" });
        return;
      } catch {
        // Cancelled, or the sheet failed - fall through to the clipboard
        // rather than leaving the button looking broken.
      }
    }
    // Nothing appends the link here, so it goes on the end by hand.
    await navigator.clipboard.writeText(`${body}\n\n${dailyLink}`);
    posthog.capture("daily_puzzle_shared", { method: "clipboard" });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error && !state) {
    return <p className="text-center text-sm text-red-400 py-10">{error}</p>;
  }
  if (!state) {
    return (
      <div className="flex justify-center py-16">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
      </div>
    );
  }

  const left = state.maxGuesses - state.guessesUsed;
  const answer = state.answer ? PUZZLE_PLAYERS_BY_ID.get(state.answer.espnId) : undefined;

  return (
    <div className="flex flex-col gap-5" style={{ fontFamily: "var(--font-game)" }}>
      {/* Finished: the result comes FIRST, above the title as well as the
          board. It is the thing somebody came back for and the only part
          anyone screenshots, and it was sitting under a header that says
          the same word every day. Unfinished, the header leads as normal.
          The title lives in the page above this component, so the page
          hands it in and this decides where it sits. */}
      {showJoin && (
        <StillBrewingModal used={state.guessesUsed} max={state.maxGuesses} onClose={() => setShowJoin(false)} />
      )}

      {state.finished && state.answer && !celebrating && (
        <div ref={revealRef}>
          <Reveal state={state} answer={answer} onShare={share} copied={copied} grid={shareGrid(state)} />
        </div>
      )}

      {/* ONE card: title, guess field, board. They used to be three
          separately bordered things floating with 20px between them,
          which made a single activity look like three unrelated widgets
          stacked up. Inside, the sections are divided by a hairline
          rather than by air - the same rule the legend already used. */}
      <div style={{ background: CARD, border: CARD_EDGE, borderRadius: 18, boxShadow: DROP }}>
        {header}

        {/* The board goes as wide as the card allows; the input does not.
            A search field stretched to 1150px is a lot of runway for a
            name, and it drifts away from the list it drops down over. */}
        {/* No rule above the field. The title and the thing you type in
            are one gesture - read the name of the game, then type - and a
            hairline between them made the header look like a separate
            panel stacked on top. The board keeps its rule, because that
            IS a different section. */}
        {!state.finished && (
          <div className="mx-auto flex w-full max-w-2xl flex-col px-4 pb-4 pt-1 lg:px-5 lg:pb-5">
          {/* No title and no label. The field's own placeholder says
              "Guess the Player", so a heading above it saying the same
              three words was a line of height for nothing.
              The field is alone on its row so it sits on the card's own
              centre line - sharing the row with the count pushed it off
              axis by half the width of the count, which reads as a
              mistake rather than as a layout. */}
          <div className="relative">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                // A new search is a new list, so the highlight goes back
                // to the top rather than pointing at whatever happens to
                // be in that slot now.
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Guess the Player"
              autoComplete="off"
              disabled={busy}
              aria-label="Guess a player"
              aria-autocomplete="list"
              className="w-full px-3.5 py-3 text-[.95rem] font-medium outline-none transition-shadow duration-150 focus:shadow-[0_0_0_3px_#2b3a56] disabled:opacity-60 lg:px-4 lg:py-3.5 lg:text-base"
              style={{
                background: FIELD,
                border: CARD_EDGE,
                borderRadius: 12,
                color: TEXT,
              }}
            />
            {query.trim().length > 0 && (
              <div
                ref={menuRef}
                role="listbox"
                className="puzzle-menu absolute z-30 mt-2 max-h-[70vh] w-full overflow-y-auto overflow-x-hidden"
                style={{ background: FIELD, border: CARD_EDGE, borderRadius: 12, boxShadow: DROP }}
              >
                {matches.length === 0 && (
                  <p className="px-3.5 py-3 text-sm font-medium" style={{ color: MUTED }}>
                    No player by that name.
                  </p>
                )}
                {matches.map((p, i) => {
                  const already = guessedIds.has(p.espnId);
                  return (
                    <button
                      key={p.espnId}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      data-active={i === active && !already}
                      disabled={already}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => guess(p)}
                      className={`puzzle-option flex w-full items-center gap-2.5 py-2 pr-3 text-left ${
                        already ? "opacity-40" : ""
                      }`}
                      style={{ paddingLeft: 10 }}
                    >
                      <PlayerFace espnId={p.espnId} name={p.name} team={p.team} size={28} ring={2} />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: TEXT }}>
                        {p.name}
                      </span>
                      <span className="shrink-0 text-[10px] font-semibold" style={{ color: MUTED }}>
                        {already ? "GUESSED" : `${p.team} · ${p.position}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* A caption under the field rather than a number beside it.
              "2 of 8 left" needed reading twice to work out which number
              was which; "2 guesses remaining" is the same fact in words
              you do not have to parse. Small and unbold on purpose - it
              is a status line, not a headline, and at 11px it costs one
              line of leading instead of a whole row of the header.
              It goes red for the last two, which is the only point in a
              run where the count is worth looking at. */}
          <p
            className="mt-1.5 text-center text-[11px] font-normal leading-none"
            style={{ color: left <= 2 ? ALARM : MUTED }}
          >
            {left} {left === 1 ? "guess" : "guesses"} remaining
          </p>

          {error && <p className="mt-2 text-center text-xs font-semibold text-red-400">{error}</p>}

          {/* No longer opens with "Eight guesses" - the caption an inch
              above it says how many are left, and saying it twice on the
              one screen where both are visible read as a stutter. */}
          {state.guesses.length === 0 && (
            <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: MUTED }}>
              Every guess tells you what it has in common with the mystery player — green is an exact match, yellow is
              close, and an arrow points the way.
            </p>
          )}
          </div>
        )}

      {state.guesses.length > 0 && (
        <div
          className="puzzle-board px-2 py-3 md:p-[18px] lg:p-6"
          data-celebrate={celebrating ? "1" : undefined}
          style={{ borderTop: CARD_EDGE }}
        >
          {/* One header row on desktop, where the columns line up under it.
              On a phone the board stacks into a card per guess and every
              chip carries its own label instead - same information, no
              row of headings marooned above a grid it no longer describes. */}
          <div
            className="mb-2 hidden gap-2 text-[10px] font-semibold tracking-wider md:grid lg:mb-2.5 lg:text-[11px]"
            style={{ gridTemplateColumns: columnTrack, color: MUTED }}
          >
            <div className="pr-2">PLAYER</div>
            {visibleColumns.map((c) => (
              <div key={c.key} className="text-center">
                {c.label}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:gap-2">
            {state.guesses.map((g) => (
              <div
                key={g.espnId}
                className="puzzle-row flex flex-col gap-2 md:grid md:items-stretch md:gap-2"
                data-win={g.correct ? "1" : undefined}
                style={{ gridTemplateColumns: columnTrack }}
              >
                {/* items-STRETCH, so the plate can be h-full and match the
                    chips. Centring it here was what left it 52px tall in
                    a 62px row. */}
                <div className="flex min-w-0 md:items-stretch md:pr-2">
                  <PlayerPlate
                    espnId={g.espnId}
                    name={g.name}
                    team={(PUZZLE_PLAYERS_BY_ID.get(g.espnId)?.team ?? "KC") as TeamAbbr}
                  />
                </div>

                {/* md:contents dissolves this wrapper on desktop so the
                    chips become cells of the row's own grid and line up
                    with the header.
                    All seven across on a phone too, not four and then
                    three. A row that wraps stops being a row: the eye
                    reads two half-rows and has to work out that they are
                    one guess. Seven narrow chips that each take two lines
                    of text is the trade, and it is the right way round -
                    the SHAPE of a row is what you scan, the text is what
                    you stop and read. */}
                <div className="grid grid-cols-7 gap-1 md:contents">
                  {visibleColumns.map((c, i) => (
                    <Chip
                      key={c.key}
                      column={c}
                      cell={cellOf(g, c.key)}
                      index={i}
                      rollCall={celebrating && g.correct}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Legend columns={visibleColumns} />
        </div>
      )}
      </div>
    </div>
  );
}

// One hint. Carries its own label below the md breakpoint, because that
// is where the header row stops existing.
function Chip({
  column,
  cell,
  index,
  rollCall = false,
}: {
  column: (typeof COLUMNS)[number];
  cell: { value: string | number | null; status: Verdict; direction?: NumCell["direction"] };
  index: number;
  // This chip is in the row that just won, and the win is being played.
  rollCall?: boolean;
}) {
  const { bg, ink } = cellStyle(column.key, cell);
  const text = formatCell(column.key, cell.value);
  const arrow = cell.direction === "up" ? "↑" : cell.direction === "down" ? "↓" : null;

  // ONE type size on every chip in the row. There used to be three - 15px
  // for short values, 12px for anything over eight characters, 13px for
  // college - each one a local fix for a value that would not fit, and
  // together they made a row look like it had been set by three different
  // people. "NFC South" next to "QB" in a size larger reads as emphasis
  // that is not there.
  //
  // The size that fits the worst case is the size everything gets, and
  // the long values buy their room by wrapping instead: "NFC" over
  // "South", "Mississippi" over "State". A chip is two lines tall or one,
  // and the row was already going to be as tall as its tallest chip.
  // 12px is the size the long values were already using, so unifying on
  // it is "everything comes down to the smallest", not "everything grows".
  // A 79px chip has 67px of room once the border and padding are off it,
  // and 67px is not enough for a word like "Massachusetts" at ANY size a
  // person would want to read - 9px is the largest that clears it, which
  // is not a real option. So the long single words break, as they already
  // do today at 13px, and hyphens:auto is set to make that break a proper
  // hyphenation where the browser can manage one.
  // tracking-tight only on the phone, where a 45px chip leaves 33px of
  // room and "Mississippi" wants 33.8 of it. Tightening buys the ~2px
  // that keeps it whole; the alternative was another step down in size,
  // which costs legibility on every chip to fix one.
  const SIZE = "hyphens-auto text-[7px] tracking-tight md:text-[10px] md:tracking-normal lg:text-[12px]";

  // DIV always breaks between its two words, even on a desktop chip wide
  // enough to hold "NFC North" on one line. Left to wrap on its own it
  // would be one line at lg and two at md, so a column that is the same
  // fact everywhere would change shape as the window did. Every division
  // is conference-then-region, so the space is always the right place to
  // break it. Everything else wraps only when it has to.
  const lines = column.key === "division" ? text.split(" ") : null;

  return (
    <div
      className="puzzle-chip flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-1.5 md:px-0 md:py-3 lg:py-3.5"
      title={`${column.label}: ${text}`}
      style={{
        background: bg,
        color: ink,
        border: EDGE,
        borderRadius: 10,
        // The colour this chip lands on, for the roll-call keyframes to
        // finish at. Read off the chip rather than assumed to be green:
        // a winning row is normally seven hits, but a column the answer
        // has no data for is a grey "?" even when you have named the
        // right player, and flipping that one to green would be a lie.
        ["--chip-bg" as string]: bg,
        // boxShadow lives in .puzzle-chip, not here - inline styles
        // outrank stylesheet rules, and it was stopping the hover shadow
        // from ever applying.
        //
        // 120ms apart during the roll call rather than 45: the entry
        // stagger is meant to be felt and not seen, and this one is the
        // whole point of the moment.
        animationDelay: `${index * (rollCall ? 120 : 45)}ms`,
      }}
    >
      {/* 6px, not 7. The value came down to 7 when every chip went to one
          size, which left the label the same size as the thing it labels
          and in a heavier weight - so TEAM read louder than MIN. */}
      <span className="text-[6px] font-semibold uppercase leading-none tracking-tight md:text-[8px] md:tracking-wider md:hidden" style={{ opacity: 0.55 }}>
        {column.label}
      </span>
      <span className="flex w-full items-center justify-center px-0.5 md:px-1">
        {/* The VALUE is what gets centred, not the value-plus-arrow. When
            the two shared a centred flex row, an arrow shoved the number
            left by half its own width, so 6'4" with a hint sat on a
            different axis to 6'4" without one and the column looked
            ragged. The arrow hangs off the value's right edge instead -
            out of the centring entirely. Only the numeric columns ever
            get one and their values are four characters at most, so
            there is always room for it to hang there. */}
        <span
          className={`relative min-w-0 break-words text-center font-medium leading-[1.12] tabular-nums md:leading-tight ${SIZE}`}
        >
          {lines ? lines.map((line) => <span key={line} className="block">{line}</span>) : text}
          {arrow && (
            <span
              aria-label={cell.direction === "up" ? "higher" : "lower"}
              className="absolute left-full top-1/2 ml-[3px] -translate-y-1/2 font-semibold"
            >
              {arrow}
            </span>
          )}
        </span>
      </span>
    </div>
  );
}

// Yellow means something different in every column it can appear in, and
// a colour whose meaning you have to guess at is not a hint. Built from
// the columns actually on the board, so it never explains a column that
// is not there.
function Legend({ columns }: { columns: readonly (typeof COLUMNS)[number][] }) {
  const explained = columns.filter((c) => CLOSE_MEANS[c.key]);

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3 lg:mt-5 lg:pt-4" style={{ borderColor: RULE }}>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-semibold lg:gap-x-5 lg:text-xs"
        style={{ color: MUTED }}
      >
        <span className="flex items-center gap-1.5">
          <Swatch bg={TONE.hit.bg} /> EXACT
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch bg={TONE.close.bg} /> CLOSE
        </span>
        <span className="flex items-center gap-1.5">
          <Swatch bg={TONE.miss.bg} /> NO MATCH
        </span>
      </div>
      <p className="text-[10px] leading-relaxed lg:text-xs" style={{ color: MUTED }}>
        Close means{" "}
        {explained.map((c, i) => (
          <span key={c.key}>
            {i > 0 && (i === explained.length - 1 ? ", and " : ", ")}
            <span style={{ color: TEXT, fontWeight: 700 }}>{c.label}</span> {CLOSE_MEANS[c.key]}
          </span>
        ))}
        .
      </p>
    </div>
  );
}

function Swatch({ bg }: { bg: string }) {
  return (
    <span
      aria-hidden
      className="inline-block"
      style={{ width: 12, height: 12, background: bg, border: EDGE, borderRadius: 4 }}
    />
  );
}

// The end of the round, which is the only part of this anyone photographs.
// The card takes the team's colour, the crest sits behind the face, and the
// name lands in the same display face as the rest of the site.
function Reveal({
  state,
  answer,
  onShare,
  copied,
  grid,
}: {
  state: PuzzleState;
  answer: PuzzlePlayer | undefined;
  onShare: () => void;
  copied: boolean;
  // The emoji block the share button is about to put on the clipboard,
  // shown so nobody has to send it to find out what it says.
  grid: string;
}) {
  const team = (answer?.team ?? state.answer?.team) as TeamAbbr | undefined;
  const brand = team ? TEAMS[team]?.color : undefined;
  const { bg, ink } = teamTile(brand ?? "#334155");
  const meta = [team ? `${TEAMS[team].name}` : null, state.answer?.position, answer?.jersey ? `No. ${answer.jersey}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="puzzle-reveal mx-auto w-full max-w-2xl"
      style={{ background: CARD, border: CARD_EDGE, borderRadius: 18, boxShadow: DROP, overflow: "hidden" }}
    >
      <div
        className="relative flex flex-col items-center gap-2 overflow-hidden px-4 pt-6 pb-5"
        style={{ background: bg, color: ink, borderBottom: EDGE }}
      >
        {team && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 grid select-none place-items-center"
            style={{ fontFamily: "var(--font-display)", fontSize: "7rem", lineHeight: 1, opacity: 0.13 }}
          >
            {team}
          </span>
        )}
        {state.answer && team && (
          <span className="relative z-10">
            <PlayerFace espnId={state.answer.espnId} name={state.answer.name} team={team} size={84} ring={4} />
          </span>
        )}
        <span
          className="relative z-10 text-center leading-tight"
          style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem" }}
        >
          {state.answer?.name}
        </span>
        <span className="relative z-10 text-[.72rem] font-semibold uppercase tracking-wider">{meta}</span>
      </div>

      <div className="mx-auto flex w-full max-w-md flex-col gap-2.5 px-4 pt-3 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold" style={{ color: TEXT }}>
            {state.solved ? `Solved in ${state.guessesUsed}` : "Out of guesses"}
          </span>
          {state.solved && (
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: ".78rem",
                background: "#22c55e",
                color: "#04240f",
                border: EDGE,
                borderRadius: 999,
                padding: "4px 12px",
                boxShadow: `2px 2px 0 ${INK}`,
              }}
            >
              +{state.pointsAwarded} PTS
            </span>
          )}
        </div>
        {/* A preview, not a decoration. leading-none and a tight letter
            spacing so the rows read as a block of squares rather than as
            seven separate emoji per line - it should look like the thing
            that lands in a message, which is how somebody decides whether
            to send it. */}
        <div
          className="flex flex-col items-center gap-1 rounded-xl px-3 py-2.5"
          style={{ background: FIELD, border: CARD_EDGE }}
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.14em]" style={{ color: MUTED }}>
            What you&rsquo;ll share
          </span>
          <pre
            className="m-0 text-center font-sans text-[13px] leading-[1.35] tracking-[0.06em] sm:text-[15px]"
            style={{ color: TEXT }}
          >
            {grid}
          </pre>
        </div>

        <p className="text-xs" style={{ color: MUTED }}>
          {state.solved ? "New player tomorrow at midnight ET." : "New player tomorrow — the streak survives."}
        </p>
        {/* Orange rather than yellow: yellow is a verdict on this board
            now, and a button wearing a verdict's colour reads as one. */}
        <button
          type="button"
          onClick={onShare}
          className="puzzle-press"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: ".85rem",
            background: "#ff7a45",
            color: INK,
            border: EDGE,
            borderRadius: 12,
            padding: 11,
            boxShadow: `3px 4px 0 ${INK}`,
          }}
        >
          {copied ? "COPIED" : "SHARE RESULT"}
        </button>
        <p className="text-center text-[10px]" style={{ color: MUTED }}>
          Shares squares only — no name, no team.
        </p>
      </div>
    </div>
  );
}
