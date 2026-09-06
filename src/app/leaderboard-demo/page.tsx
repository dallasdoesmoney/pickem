"use client";

// TEMPORARY. Five ways to draw the leaderboard, and an audit of what
// else could go on it.
//
// Today it is a stack of separately bordered cards, one per player, each
// showing rank, avatar, name and a W-L record. Two problems with that,
// and the second is the bigger one:
//
//   IT LOOKS LIKE A LIST OF THINGS rather than a standings table. Every
//   row has its own border and its own background, so twenty players is
//   twenty floating objects instead of one thing you read down.
//
//   IT SHOWS ALMOST NOTHING IT ALREADY HAS. total_points decides every
//   tie on the board and is invisible. So is the level, the rank name,
//   the progress to the next one, and the win rate. Every one of those is
//   already in the row the page fetches - see LeaderboardRow in
//   src/lib/supabase/leaderboard.ts - and none of it is drawn.
//
// So the variants below are one section rather than N cards, and they
// differ mostly in how much of what is already there they put on screen.
//
// Delete this route, and the noindex beside it, once one is chosen.

import { useState } from "react";
import { getLevelInfo } from "@/lib/levels";

type Row = {
  id: string;
  name: string;
  correct: number;
  graded: number;
  points: number;
  streak: number;
  creator?: boolean;
  me?: boolean;
  // EVERYTHING BELOW IS ALREADY IN THE DATABASE. Not in the leaderboard
  // VIEW - that is the change - but in tables that are written today,
  // by features that already ship. See the audit at the bottom of the
  // page for where each one comes from.
  lockW: number; // weekly_picks.is_lock, graded against game_results
  lockL: number;
  bestWeek: { week: number; correct: number; of: number };
  form: boolean[]; // the last five weeks: won more than half, or not
  longestStreak: number; // profiles.longest_check_in_streak
  nameplate: { played: number; solved: number; avg: number }; // the daily game
  badges: string[]; // user_badges
  topTeam: string; // the team they back most, out of their own picks
};

// A believable board: a tight top, a long tail, a couple of small sample
// sizes near the top (the case a bare W-L is misleading about), and YOU
// well down it - which is the case every one of these has to handle and
// the current design does not.
const extra = (
  lockW: number,
  lockL: number,
  bw: [number, number, number],
  form: string,
  longest: number,
  np: [number, number, number],
  badges: string[],
  topTeam: string,
) => ({
  lockW,
  lockL,
  bestWeek: { week: bw[0], correct: bw[1], of: bw[2] },
  form: [...form].map((c) => c === "W"),
  longestStreak: longest,
  nameplate: { played: np[0], solved: np[1], avg: np[2] },
  badges,
  topTeam,
});

const ROWS: Row[] = [
  { id: "1", name: "Marcus Webb", correct: 141, graded: 176, points: 4120, streak: 23, creator: true, ...extra(8, 3, [7, 15, 16], "WWLWW", 31, [88, 79, 4.1], ["🎯", "🔥", "📈"], "KC") },
  { id: "2", name: "dallasdoesmoney", correct: 139, graded: 176, points: 3980, streak: 11, creator: true, ...extra(9, 2, [4, 14, 16], "WWWLW", 24, [91, 84, 3.8], ["🎯", "👑"], "DAL") },
  { id: "3", name: "Priya N.", correct: 138, graded: 176, points: 3610, streak: 4, ...extra(6, 5, [9, 14, 16], "LWWWL", 12, [70, 61, 4.6], ["🔥"], "PHI") },
  { id: "4", name: "toothpick", correct: 133, graded: 176, points: 3350, streak: 0, ...extra(7, 4, [2, 13, 16], "WLWLW", 9, [44, 35, 5.0], [], "BUF") },
  { id: "5", name: "Jordan Reyes", correct: 130, graded: 168, points: 3190, streak: 7, ...extra(5, 6, [11, 13, 15], "WWLLW", 18, [66, 55, 4.7], ["📈"], "SF") },
  { id: "6", name: "bigplaybrian", correct: 128, graded: 176, points: 2940, streak: 2, ...extra(4, 7, [3, 12, 16], "LWLWW", 6, [30, 22, 5.3], [], "GB") },
  { id: "7", name: "Sam Okafor", correct: 124, graded: 160, points: 2810, streak: 0, ...extra(6, 4, [8, 13, 16], "WLLWL", 14, [51, 44, 4.4], ["🎯"], "BAL") },
  { id: "8", name: "the_commish", correct: 121, graded: 176, points: 2640, streak: 15, ...extra(3, 8, [1, 12, 16], "LLWWL", 15, [95, 80, 4.2], ["🔥", "👑"], "NYJ") },
  { id: "9", name: "Ellie Barnes", correct: 119, graded: 152, points: 2480, streak: 1, ...extra(5, 4, [6, 12, 15], "WLWLL", 8, [40, 34, 4.9], [], "DET") },
  { id: "10", name: "nightcapnate", correct: 117, graded: 176, points: 2310, streak: 0, ...extra(4, 7, [10, 12, 16], "LLWLW", 5, [22, 15, 5.5], [], "LAR") },
  { id: "11", name: "you", correct: 96, graded: 144, points: 1740, streak: 5, me: true, ...extra(7, 2, [5, 12, 16], "WWLWW", 11, [63, 58, 4.0], ["🎯", "🔥"], "CIN") },
];

const pct = (r: Row) => (r.graded === 0 ? 0 : Math.round((r.correct / r.graded) * 100));
const initial = (n: string) => n.charAt(0).toUpperCase();

const PANEL = "#101f3d";
const EDGE = "rgba(255,255,255,0.10)";
const HAIR = "rgba(255,255,255,0.07)";

function Avatar({ row, size = 36 }: { row: Row; size?: number }) {
  const color = getLevelInfo(row.points).rankColor;
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-white/10"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}, 0 0 8px -2px ${color}`, fontSize: size * 0.36 }}
    >
      {initial(row.name)}
    </span>
  );
}

// The medal, for the three places that have one. Everywhere else the
// number does the job, and giving 4th a coloured disc would say it won
// something.
function Rank({ i }: { i: number }) {
  const medal = ["#ffd35c", "#cfd8e6", "#d79a63"][i];
  if (!medal) {
    return (
      <span className="w-7 text-center text-[13px] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
        {i + 1}
      </span>
    );
  }
  return (
    <span
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px]"
      style={{ fontFamily: "var(--font-display)", background: medal, color: "#0b1220" }}
    >
      {i + 1}
    </span>
  );
}

function Name({ row }: { row: Row }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate text-[14px]">{row.name}</span>
      {row.creator && <span className="text-[11px] text-sky-300">✓</span>}
      {row.streak > 0 && <span className="shrink-0 text-[11px] text-white/45">🔥{row.streak}</span>}
    </span>
  );
}

// ---------------------------------------------------------------------
// A — what ships now. One bordered card per player.
// ---------------------------------------------------------------------

function VariantA() {
  return (
    <div className="flex flex-col gap-2">
      {ROWS.map((r, i) => (
        <div
          key={r.id}
          className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
          style={{ background: r.me ? "rgba(52,211,153,0.10)" : PANEL, borderColor: r.me ? "#34d399" : EDGE }}
        >
          <span className="w-6 text-center text-[13px] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
            {i + 1}
          </span>
          <Avatar row={r} />
          <Name row={r} />
          <span className="ml-auto shrink-0 text-[14px]" style={{ fontFamily: "var(--font-display)" }}>
            {r.correct}-{r.graded - r.correct}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// B — one table. The smallest change that answers both complaints: a
// single panel with hairlines instead of N cards, and the columns the
// data already has.
// ---------------------------------------------------------------------

function VariantB() {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: PANEL, borderColor: EDGE }}>
      {/* FOUR NUMERIC COLUMNS DO NOT FIT A PHONE. With rank, win rate,
          points and record all in their own column at 390px the names
          were down to "Marc…" and "bigplayb…", which is the one thing a
          leaderboard must never do. Win rate moves under the record - it
          is the least-glanced-at of the four and reads perfectly well as
          a sub-line. */}
      <div
        className="grid items-center gap-2.5 px-3 py-2 text-[9.5px] tracking-[0.14em] text-white/35"
        style={{ gridTemplateColumns: "26px 1fr 46px 58px", fontFamily: "var(--font-display)" }}
      >
        <span />
        <span>PLAYER</span>
        <span className="text-right">PTS</span>
        <span className="text-right">RECORD</span>
      </div>
      {ROWS.map((r, i) => (
        <div
          key={r.id}
          className="grid items-center gap-2.5 px-3 py-2.5"
          style={{
            gridTemplateColumns: "26px 1fr 46px 58px",
            borderTop: `1px solid ${HAIR}`,
            background: r.me ? "rgba(52,211,153,0.10)" : undefined,
          }}
        >
          <Rank i={i} />
          <span className="flex min-w-0 items-center gap-2">
            <Avatar row={r} size={28} />
            <Name row={r} />
          </span>
          <span className="text-right text-[13px] tabular-nums text-white/70">{r.points.toLocaleString()}</span>
          <span className="text-right">
            <span className="block text-[14px] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
              {r.correct}-{r.graded - r.correct}
            </span>
            <span className="block text-[10.5px] tabular-nums text-white/40">{pct(r)}%</span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// C — a podium on top of the table. The top three are the only rows
// anybody looks at first, so they get drawn rather than listed.
// ---------------------------------------------------------------------

function VariantC() {
  const top = ROWS.slice(0, 3);
  const rest = ROWS.slice(3);
  // Second, first, third - the order they stand on a podium, not the
  // order they finished.
  const podium = [top[1], top[0], top[2]];
  const heights = [64, 88, 52];
  const medals = ["#cfd8e6", "#ffd35c", "#d79a63"];
  const places = [2, 1, 3];
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: PANEL, borderColor: EDGE }}>
      <div className="flex items-end justify-center gap-3 px-3 pb-4 pt-6">
        {podium.map((r, k) => (
          <div key={r.id} className="flex w-[30%] flex-col items-center">
            <Avatar row={r} size={k === 1 ? 52 : 40} />
            <span className="mt-1.5 w-full truncate text-center text-[12px]">{r.name}</span>
            <span className="text-[11px] tabular-nums text-white/45">
              {r.correct}-{r.graded - r.correct}
            </span>
            <div
              className="mt-2 grid w-full place-items-center rounded-t-lg"
              style={{ height: heights[k], background: `linear-gradient(180deg, ${medals[k]}, ${medals[k]}22)` }}
            >
              <span className="text-[18px]" style={{ fontFamily: "var(--font-display)", color: "#0b1220" }}>
                {places[k]}
              </span>
            </div>
          </div>
        ))}
      </div>
      {rest.map((r, i) => (
        <div
          key={r.id}
          className="grid items-center gap-3 px-3 py-2.5"
          style={{
            gridTemplateColumns: "28px 1fr 52px 58px",
            borderTop: `1px solid ${HAIR}`,
            background: r.me ? "rgba(52,211,153,0.10)" : undefined,
          }}
        >
          <span className="w-7 text-center text-[13px] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
            {i + 4}
          </span>
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar row={r} size={30} />
            <Name row={r} />
          </span>
          <span className="text-right text-[13px] tabular-nums text-white/70">{r.points.toLocaleString()}</span>
          <span className="text-right text-[14px] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
            {r.correct}-{r.graded - r.correct}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
// D — the table, with the LEVEL made visible. The rank colour becomes a
// stripe down the left of each row and the bar under the name is how far
// that player is through their current level.
// ---------------------------------------------------------------------

function VariantD() {
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: PANEL, borderColor: EDGE }}>
      {ROWS.map((r, i) => {
        const lvl = getLevelInfo(r.points);
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 py-2.5 pr-3"
            style={{
              borderTop: i === 0 ? undefined : `1px solid ${HAIR}`,
              borderLeft: `3px solid ${lvl.rankColor}`,
              paddingLeft: 9,
              background: r.me ? "rgba(52,211,153,0.10)" : undefined,
            }}
          >
            <Rank i={i} />
            <Avatar row={r} size={32} />
            <span className="min-w-0 flex-1">
              <Name row={r} />
              <span className="mt-1 flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${Math.round(lvl.progress * 100)}%`, background: lvl.rankColor }}
                  />
                </span>
                <span className="shrink-0 text-[9.5px] tracking-[0.1em] text-white/40" style={{ fontFamily: "var(--font-display)" }}>
                  {lvl.rankEmoji} {lvl.rankName.toUpperCase()} {lvl.subLevel}
                </span>
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-[14px] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {r.correct}-{r.graded - r.correct}
              </span>
              <span className="block text-[10.5px] tabular-nums text-white/40">{r.points.toLocaleString()} pts</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// E — the season sheet. One panel, a win-rate bar behind every row, and
// YOUR ROW PINNED to the bottom of it. On a board of two hundred that
// pinned row is the single most useful thing on the page and none of the
// other four have it.
// ---------------------------------------------------------------------

function VariantE({ pinned }: { pinned: boolean }) {
  const list = pinned ? ROWS.slice(0, 8) : ROWS;
  const me = ROWS.find((r) => r.me)!;
  const myPlace = ROWS.findIndex((r) => r.me) + 1;
  const line = (r: Row, place: number, sticky = false) => (
    <div
      key={`${r.id}-${sticky ? "pin" : "row"}`}
      className="relative flex items-center gap-3 px-3 py-2.5"
      style={{
        borderTop: sticky ? `1px solid ${EDGE}` : `1px solid ${HAIR}`,
        background: r.me ? "rgba(52,211,153,0.10)" : undefined,
      }}
    >
      {/* The win rate, as the row's own ground. It reads as a bar chart
          down the table without spending a column on one. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0"
        style={{ width: `${pct(r)}%`, background: "rgba(62,203,120,0.09)", pointerEvents: "none" }}
      />
      <span className="relative">
        <Rank i={place - 1} />
      </span>
      <Avatar row={r} size={32} />
      <span className="relative min-w-0 flex-1">
        <Name row={r} />
      </span>
      <span className="relative shrink-0 text-right">
        <span className="block text-[14px] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
          {r.correct}-{r.graded - r.correct}
        </span>
        <span className="block text-[10.5px] tabular-nums text-white/40">
          {pct(r)}% · {r.points.toLocaleString()}
        </span>
      </span>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: PANEL, borderColor: EDGE }}>
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: `1px solid ${EDGE}`, background: "rgba(255,255,255,0.03)" }}
      >
        <span className="text-[10px] tracking-[0.16em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
          SEASON STANDINGS
        </span>
        <span className="text-[11px] text-white/35">{ROWS.length} players · 11 weeks graded</span>
      </div>
      {list.map((r, i) => line(r, i + 1))}
      {pinned && (
        <>
          <div className="px-3 py-1 text-center text-[11px] text-white/25">···</div>
          {line(me, myPlace, true)}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// F — the season sheet, with a drawer.
//
// THE ANSWER TO "what else is there about the player". Quite a lot, and
// none of it belongs in the row: a leaderboard's job is to be scanned,
// and a row carrying nine numbers is not scanned, it is squinted at. So
// the row stays exactly as tight as E and everything else lives one tap
// down.
//
// Every stat in the drawer comes out of a table that is written today.
// See the audit under this - the change is to the leaderboard VIEW, not
// to what the app collects.
// ---------------------------------------------------------------------

function FormPips({ form }: { form: boolean[] }) {
  return (
    <span className="flex gap-[3px]">
      {form.map((w, i) => (
        <span
          key={i}
          title={w ? "winning week" : "losing week"}
          style={{ width: 7, height: 14, borderRadius: 2, background: w ? "#3ecb78" : "rgba(255,255,255,0.16)" }}
        />
      ))}
    </span>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[9px] tracking-[0.14em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
        {label}
      </p>
      <p className="mt-0.5 text-[15px] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
        {value}
      </p>
      {sub && <p className="text-[10.5px] text-white/40">{sub}</p>}
    </div>
  );
}

function VariantF() {
  const [open, setOpen] = useState<string | null>("2");
  return (
    <div className="overflow-hidden rounded-2xl border" style={{ background: PANEL, borderColor: EDGE }}>
      <div
        className="flex items-center justify-between px-3 py-2.5"
        style={{ borderBottom: `1px solid ${EDGE}`, background: "rgba(255,255,255,0.03)" }}
      >
        <span className="text-[10px] tracking-[0.16em] text-white/45" style={{ fontFamily: "var(--font-display)" }}>
          SEASON STANDINGS
        </span>
        <span className="text-[11px] text-white/35">tap a row</span>
      </div>
      {ROWS.slice(0, 6).map((r, i) => (
        <div key={r.id}>
          <button
            type="button"
            onClick={() => setOpen(open === r.id ? null : r.id)}
            className="relative flex w-full items-center gap-3 px-3 py-2.5 text-left"
            style={{ borderTop: `1px solid ${HAIR}`, background: r.me ? "rgba(52,211,153,0.10)" : undefined }}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0"
              style={{ width: `${pct(r)}%`, background: "rgba(62,203,120,0.09)" }}
            />
            <span className="relative">
              <Rank i={i} />
            </span>
            <Avatar row={r} size={32} />
            <span className="relative min-w-0 flex-1">
              <Name row={r} />
            </span>
            {/* The one extra thing worth putting IN the row: five weeks
                of form. It is five pixels wide per week and says more
                about where somebody is going than the season total. */}
            <span className="relative shrink-0">
              <FormPips form={r.form} />
            </span>
            <span className="relative shrink-0 text-right">
              <span className="block text-[14px] tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                {r.correct}-{r.graded - r.correct}
              </span>
              <span className="block text-[10.5px] tabular-nums text-white/40">{pct(r)}%</span>
            </span>
          </button>

          {open === r.id && (
            <div className="px-3 pb-4 pt-1" style={{ background: "rgba(0,0,0,0.22)" }}>
              <div className="grid grid-cols-3 gap-y-3 gap-x-2">
                <Stat label="LOCK OF WK" value={`${r.lockW}-${r.lockL}`} sub={`${Math.round((100 * r.lockW) / (r.lockW + r.lockL))}% on the big one`} />
                <Stat label="BEST WEEK" value={`${r.bestWeek.correct}/${r.bestWeek.of}`} sub={`week ${r.bestWeek.week}`} />
                <Stat label="POINTS" value={r.points.toLocaleString()} sub={`${getLevelInfo(r.points).rankEmoji} ${getLevelInfo(r.points).rankName}`} />
                <Stat label="STREAK" value={`${r.streak}`} sub={`best ${r.longestStreak}`} />
                <Stat label="NAMEPLATE" value={`${Math.round((100 * r.nameplate.solved) / r.nameplate.played)}%`} sub={`${r.nameplate.played} played · ${r.nameplate.avg} avg`} />
                <Stat label="BACKS MOST" value={r.topTeam} sub="out of their own picks" />
              </div>
              {r.badges.length > 0 && (
                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/45">
                  <span className="text-[9px] tracking-[0.14em]" style={{ fontFamily: "var(--font-display)" }}>
                    BADGES
                  </span>
                  <span className="text-[15px]">{r.badges.join(" ")}</span>
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------

const VARIANTS = [
  { key: "a", name: "A — What ships now", note: "One bordered card per player: rank, avatar, name, record. The control.", render: () => <VariantA /> },
  {
    key: "b",
    name: "B — One table",
    note: "A single panel with hairlines instead of eleven floating cards, and the numbers the data already has. Points is the tiebreaker for every position on this board and today it is invisible. Win rate sits under the record rather than in its own column — four numeric columns at 390px cut the names down to “Marc…” and “bigplayb…”.",
    render: () => <VariantB />,
  },
  {
    key: "c",
    name: "C — Podium, then the table",
    note: "The top three are the rows everybody looks at first, so they get drawn rather than listed. Costs about 140px before the table starts, which on a phone is most of a screen.",
    render: () => <VariantC />,
  },
  {
    key: "d",
    name: "D — The table, with levels made visible",
    note: "The rank colour becomes a stripe down each row, and the bar under the name is how far through their current level that player is. The whole level system exists and the leaderboard currently shows none of it.",
    render: () => <VariantD />,
  },
  {
    key: "f",
    name: "F — The season sheet, with a drawer",
    note: "The answer to “what else is there about the player”: quite a lot, and none of it belongs in the row. A row carrying nine numbers is not scanned, it is squinted at — so the row stays as tight as E, five weeks of form go in beside the record, and everything else is one tap down. Every stat in the drawer comes out of a table the app writes today.",
    render: () => <VariantF />,
  },
  {
    key: "e",
    name: "E — The season sheet",
    note: "Win rate as the row's own ground — a bar chart down the table without spending a column — and YOUR ROW PINNED to the bottom. On a board of two hundred that pinned row is the most useful thing on the page, and none of the others have it.",
    render: () => <VariantE pinned />,
  },
];

// WHAT ELSE THERE IS ABOUT A PLAYER, costed honestly. Three tiers,
// because they are three genuinely different amounts of work - and the
// middle one is the surprise: almost everything worth having is already
// being written by a feature that ships, and is simply not in the
// leaderboard VIEW.
const TIERS: { head: string; tone: "free" | "view" | "new"; items: [string, string][] }[] = [
  {
    head: "Already fetched — drawn nowhere",
    tone: "free",
    items: [
      ["Points", "The tiebreaker for every position on this board, and invisible today."],
      ["Win rate", "141-35 and 96-48 are both “winning” until you divide."],
      ["Level, rank and progress", "Name, colour, tier and how far to the next one, all out of total_points."],
      ["Games graded", "Sample size. 8-0 above 130-46 is a ranking nobody trusts."],
    ],
  },
  {
    head: "One change to the leaderboard view",
    tone: "view",
    items: [
      [
        "Lock of the Week record",
        "weekly_picks.is_lock joined to game_results. Their highest-conviction pick of each week, graded — the stat the whole Lock feature exists to produce, and it is shown nowhere on the site.",
      ],
      ["Form — the last five weeks", "Same join, grouped by week. Says where somebody is going; the season total only says where they have been."],
      ["This week / best week", "Same join again, filtered or maxed."],
      ["Longest streak ever", "profiles.longest_check_in_streak. It is a column. It is right there."],
      ["Nameplate record", "The daily game already keeps played, solved and average guesses per person."],
      ["Badges", "user_badges is one join and already readable by everyone."],
      ["The team they back most", "The mode of their own picks. Not a ranking stat — a personality one, and the kind of thing people screenshot."],
      ["Follower count", "follows, one join. Turns a name into somebody worth following."],
    ],
  },
  {
    head: "Needs something new stored",
    tone: "new",
    items: [
      ["Movement since last week", "↑3 / ↓1 next to a rank. Needs a snapshot of the standings written when a week is published — one small table."],
      ["Contrarian rate", "How often they went against the crowd and were right. Computable from weekly_picks, but it needs a per-game majority worked out and cached; too heavy for a view."],
    ],
  },
];

export default function LeaderboardDemo() {
  const [width, setWidth] = useState(390);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6">
      <h1 className="text-2xl" style={{ fontFamily: "var(--font-display)" }}>
        THE LEADERBOARD
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/55">
        One section instead of eleven floating cards, and rather more on it. Every number in every variant below is
        <strong className="text-white/80"> already in the row the page fetches today</strong> &mdash; nothing here needs a
        new query, let alone a new table.
      </p>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-white/40">
        Eleven players with a believable spread: a tight top three, two people with fewer games graded than the rest, and
        YOU down at eleventh &mdash; which is the case the current design handles worst and the one most people are in.
      </p>

      <div className="mt-5 flex items-center gap-2">
        {[390, 680].map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWidth(w)}
            className={`rounded-full border px-3.5 py-1.5 text-[11px] transition-colors ${
              width === w ? "border-white/45 bg-white/10 text-white" : "border-white/15 text-white/60 hover:text-white"
            }`}
            style={{ fontFamily: "var(--font-display)" }}
          >
            {w === 390 ? "PHONE" : "WIDE"}
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-11">
        {VARIANTS.map((v) => (
          <section key={v.key}>
            <h2 className="text-[13px] text-white" style={{ fontFamily: "var(--font-display)" }}>
              {v.name}
            </h2>
            <p className="mb-3 mt-1 max-w-2xl text-[12.5px] leading-snug text-white/50">{v.note}</p>
            <div style={{ maxWidth: width }}>{v.render()}</div>
          </section>
        ))}
      </div>

      <section className="mt-14">
        <h2 className="text-[13px]" style={{ fontFamily: "var(--font-display)" }}>
          WHAT ELSE THERE IS ABOUT A PLAYER
        </h2>
        <p className="mb-4 mt-1 max-w-2xl text-[12.5px] leading-snug text-white/50">
          Rather a lot, and the middle tier is the surprise: almost everything worth having is already being written by a
          feature that ships. It is simply not in the leaderboard view.
        </p>

        <div className="flex flex-col gap-3">
          {TIERS.map((tier) => {
            const border = tier.tone === "free" ? "rgba(62,203,120,0.35)" : tier.tone === "view" ? "rgba(125,178,255,0.35)" : EDGE;
            const bg = tier.tone === "free" ? "rgba(62,203,120,0.06)" : tier.tone === "view" ? "rgba(125,178,255,0.06)" : PANEL;
            const ink = tier.tone === "free" ? "#7ee2a8" : tier.tone === "view" ? "#9dc4ff" : "rgba(255,255,255,0.45)";
            return (
              <div key={tier.head} className="rounded-2xl border p-4" style={{ borderColor: border, background: bg }}>
                <p className="text-[10px] tracking-[0.16em]" style={{ fontFamily: "var(--font-display)", color: ink }}>
                  {tier.head.toUpperCase()}
                </p>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {tier.items.map(([t, d]) => (
                    <li key={t}>
                      <p className="text-[13.5px] font-semibold">{t}</p>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-white/50">{d}</p>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
