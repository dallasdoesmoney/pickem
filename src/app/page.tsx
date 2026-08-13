"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { CURRENT_WEEK, GAMES_BY_WEEK, Game } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks, MAX_LOCKS, MAX_BLOWOUTS } from "@/hooks/usePicks";
import { groupGamesByDay } from "@/lib/groupGames";
import { TEAMS, TeamAbbr } from "@/data/teams";

const SHARE_CARD_WIDTH = 840;
const SHARE_BG = "#0e1b33";

type PickStats = ReturnType<typeof computePickStats>;

function StatPills({
  stats,
  lockedCount,
  blowoutCount,
}: {
  stats: PickStats;
  lockedCount: number;
  blowoutCount: number;
}) {
  return (
    <div className="flex gap-2 mt-4 justify-center flex-wrap">
      <div className="shrink-0 min-w-[88px] rounded-full border-2 border-white text-center px-4 py-1.5">
        <div className="text-base" style={{ fontFamily: "var(--font-display)" }}>
          {stats.underdogCount}
        </div>
        <div className="text-[9px] text-white/55">UNDERDOGS</div>
      </div>
      <div className="shrink-0 min-w-[110px] rounded-full border-2 border-emerald-400 text-center px-4 py-1.5">
        <div
          className="text-base flex items-center justify-center gap-1"
          style={{ fontFamily: "var(--font-display)", color: "#4ade80" }}
        >
          {stats.boldestTeam ? (
            <>
              <img src={stats.boldestTeam.logo} alt="" crossOrigin="anonymous" className="h-[34px] w-auto" />+{stats.boldestSpread}
            </>
          ) : (
            "-"
          )}
        </div>
        <div className="text-[9px] text-white/55">BOLDEST PICK</div>
      </div>
      <div className="shrink-0 min-w-[88px] rounded-full border-2 border-white text-center px-4 py-1.5">
        <div className="text-base" style={{ fontFamily: "var(--font-display)" }}>
          {stats.chalkPct !== null ? `${stats.chalkPct}%` : "-"}
        </div>
        <div className="text-[9px] text-white/55">CHALK</div>
      </div>
      <div
        className="shrink-0 min-w-[88px] rounded-full border-2 text-center px-4 py-1.5"
        style={{ borderColor: "#fbbf24" }}
      >
        <div className="text-base" style={{ fontFamily: "var(--font-display)", color: "#fbbf24" }}>
          {lockedCount}/{MAX_LOCKS}
        </div>
        <div className="text-[9px] text-white/55">LOCKS</div>
      </div>
      <div
        className="shrink-0 min-w-[88px] rounded-full border-2 text-center px-4 py-1.5"
        style={{ borderColor: "#f97316" }}
      >
        <div className="text-base" style={{ fontFamily: "var(--font-display)", color: "#f97316" }}>
          {blowoutCount}/{MAX_BLOWOUTS}
        </div>
        <div className="text-[9px] text-white/55">BLOWOUT</div>
      </div>
    </div>
  );
}

type FlowItem =
  | { type: "header"; key: string; label: string }
  | { type: "game"; key: string; game: Game }
  | { type: "blank"; key: string };

type DayGroup = { label: string; games: Game[] };

function flatten(groups: DayGroup[]): FlowItem[] {
  return groups.flatMap((group) => [
    { type: "header" as const, key: `h-${group.label}`, label: group.label },
    ...group.games.map((game) => ({ type: "game" as const, key: game.id, game })),
  ]);
}

// Splits into two columns by game count, row-paired for a CSS grid so a
// header on one side and a game on the other still force both cells in
// that row to the same height (the grid's native "tallest cell wins" rule
// keeps every subsequent row locked in alignment). Column 2 reserves a
// blank cell instead of repeating a day label when the split falls mid-day.
function splitIntoColumns(groups: DayGroup[]): { col1: FlowItem[]; col2: FlowItem[] } {
  const totalGames = groups.reduce((sum, g) => sum + g.games.length, 0);
  const half = Math.ceil(totalGames / 2);

  const col1: FlowItem[] = [];
  const col2: FlowItem[] = [];
  let count = 0;
  let col2Started = false;

  for (const group of groups) {
    group.games.forEach((game, i) => {
      const isFirstOfGroup = i === 0;
      if (count < half) {
        if (isFirstOfGroup) col1.push({ type: "header", key: `h1-${group.label}`, label: group.label });
        col1.push({ type: "game", key: game.id, game });
      } else {
        if (!col2Started) {
          col2.push({ type: "blank", key: `blank-${group.label}` });
          col2Started = true;
        } else if (isFirstOfGroup) {
          col2.push({ type: "header", key: `h2-${group.label}`, label: group.label });
        }
        col2.push({ type: "game", key: game.id, game });
      }
      count++;
    });
  }

  return { col1, col2 };
}

// Safari's canvas/SVG pipeline has long-standing bugs rendering
// cross-origin <img> elements inside html-to-image's foreignObject step,
// even when the source sends correct CORS headers - the failure shows up
// as blank team logos in the exported PNG. Pre-converting every logo to a
// same-origin data: URL before capture sidesteps that class of bug
// entirely (and as a side effect guarantees the image has finished
// loading, closing the separate "still mid-fetch" race too).
async function inlineImages(container: HTMLElement) {
  const imgs = Array.from(container.querySelectorAll("img"));
  const failures: string[] = [];
  await Promise.all(
    imgs.map(async (img) => {
      if (img.src.startsWith("data:")) return;
      const label = img.alt || img.src.split("/").pop() || img.src;
      try {
        const res = await fetch(img.src, { mode: "cors" });
        if (!res.ok) throw new Error(`fetch ${res.status}`);
        const blob = await res.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
          reader.readAsDataURL(blob);
        });
        await new Promise<void>((resolve, reject) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => reject(new Error("data: url failed to load")), { once: true });
          img.src = dataUrl;
        });
      } catch (err) {
        failures.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
      }
    })
  );
  return { total: imgs.length, failed: failures };
}

function computePickStats(games: Game[], picks: Record<string, TeamAbbr>) {
  const withSpread = games.filter((g) => g.favorite && g.spread !== undefined && picks[g.id]);
  const chalkGames = withSpread.filter((g) => picks[g.id] === g.favorite);
  const underdogGames = withSpread.filter((g) => picks[g.id] !== g.favorite);
  const chalkPct = withSpread.length > 0 ? Math.round((chalkGames.length / withSpread.length) * 100) : null;
  const boldest = underdogGames.reduce<Game | null>(
    (max, g) => (!max || (g.spread ?? 0) > (max.spread ?? 0) ? g : max),
    null
  );
  return {
    underdogCount: underdogGames.length,
    chalkPct,
    boldestTeam: boldest ? TEAMS[picks[boldest.id]] : null,
    boldestSpread: boldest?.spread,
  };
}

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, specials, cycleSpecial, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;
  const lockedCount = Object.values(specials).filter((s) => s === "lock").length;
  const blowoutCount = Object.values(specials).filter((s) => s === "blowout").length;
  const canAddSpecial = lockedCount < MAX_LOCKS || blowoutCount < MAX_BLOWOUTS;
  const groups = groupGamesByDay(games);
  const stats = computePickStats(games, picks);
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareDebug, setShareDebug] = useState<string[] | null>(null);

  async function handleShare() {
    if (!shareCardRef.current || sharing) return;
    setSharing(true);
    const log: string[] = [];
    try {
      log.push(`ua: ${navigator.userAgent}`);
      const { total, failed } = await inlineImages(shareCardRef.current);
      log.push(`logos: ${total - failed.length}/${total} inlined`);
      failed.forEach((f) => log.push(`  FAILED ${f}`));

      const dataUrl = await toPng(shareCardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: SHARE_BG,
      });
      log.push(`capture: ${Math.round(dataUrl.length / 1024)}kb png`);

      const filename = `pickem-week-${CURRENT_WEEK}.png`;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });

      const canShareFiles = !!navigator.canShare?.({ files: [file] });
      log.push(`canShare files: ${canShareFiles}`);

      if (canShareFiles) {
        await navigator.share({
          files: [file],
          title: "NFL Pick'em",
          text: `My Week ${CURRENT_WEEK} picks`,
        });
        log.push("share sheet: opened");
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = filename;
        link.click();
        log.push("download: triggered");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        log.push("share sheet: cancelled by user");
      } else {
        log.push(`ERROR: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
      }
    } finally {
      setSharing(false);
      setShareDebug(log);
    }
  }

  const items = flatten(groups);
  const { col1, col2 } = splitIntoColumns(groups);
  const rowCount = Math.max(col1.length, col2.length);

  const renderMobileItem = (item: FlowItem, isFirst: boolean) =>
    item.type === "header" ? (
      <h2
        key={item.key}
        className={`text-center whitespace-nowrap px-2 mb-2 text-[clamp(1.25rem,7.5vw,2.75rem)] lg:text-4xl ${
          isFirst ? "mt-0" : "mt-5"
        }`}
        style={{ fontFamily: "var(--font-display)" }}
      >
        {item.label}
      </h2>
    ) : item.type === "game" ? (
      <div key={item.key} className="mb-4">
        <GameCard
          game={item.game}
          picked={picks[item.game.id]}
          onPick={(team) => setPick(item.game.id, team)}
          special={specials[item.game.id]}
          onCycleSpecial={() => cycleSpecial(item.game.id)}
          canAddSpecial={canAddSpecial}
        />
      </div>
    ) : null;

  const renderGridCell = (item: FlowItem | undefined) => {
    if (!item || item.type === "blank") {
      return <div key={item?.key ?? Math.random()} />;
    }
    if (item.type === "header") {
      return (
        <div key={item.key} className="h-full flex items-end justify-center pb-2">
          <h2
            className="text-center whitespace-nowrap px-2 text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {item.label}
          </h2>
        </div>
      );
    }
    return (
      <GameCard
        key={item.key}
        game={item.game}
        picked={picks[item.game.id]}
        onPick={(team) => setPick(item.game.id, team)}
        special={specials[item.game.id]}
        onCycleSpecial={() => cycleSpecial(item.game.id)}
        canAddSpecial={canAddSpecial}
      />
    );
  };

  return (
    <div className="flex flex-col flex-1">
      <header className="px-4 pt-6 pb-3 max-w-4xl w-full mx-auto relative">
        <div className="flex flex-col items-center">
          <div className="text-center">
            <h1
              className="text-3xl tracking-wide"
              style={{ fontFamily: "var(--font-display)" }}
            >
              NFL PICK&rsquo;EM
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Week {CURRENT_WEEK} &middot; {pickedCount} / {games.length} picked
            </p>
          </div>
          <div className="absolute top-6 right-4 flex items-center gap-2">
            <button
              aria-label="Share your picks"
              onClick={handleShare}
              disabled={sharing}
              className="h-9 w-9 shrink-0 rounded-full border-2 border-white/40 text-white/70 flex items-center justify-center disabled:opacity-50"
            >
              {sharing ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white/80 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="M7 8l5-5 5 5" />
                  <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
                </svg>
              )}
            </button>
            <button
              aria-label="Sign in"
              className="h-9 w-9 shrink-0 rounded-full border-2 border-dashed border-white/40 text-white/50 text-lg flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>

        <StatPills stats={stats} lockedCount={lockedCount} blowoutCount={blowoutCount} />
      </header>

      <main className="flex-1 px-4 pb-10 max-w-4xl w-full mx-auto">
        {loaded && (
          <>
            <div className="flex flex-col lg:hidden">
              {items.map((item, i) => renderMobileItem(item, i === 0))}
            </div>
            <div className="hidden lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-4 lg:items-stretch">
              {Array.from({ length: rowCount }).flatMap((_, i) => [
                renderGridCell(col1[i]),
                renderGridCell(col2[i]),
              ])}
            </div>
          </>
        )}
      </main>

      {loaded && (
        <div
          aria-hidden="true"
          style={{ position: "fixed", top: 0, left: -99999, pointerEvents: "none" }}
        >
          <div
            ref={shareCardRef}
            style={{ width: SHARE_CARD_WIDTH, backgroundColor: SHARE_BG, padding: "40px 48px 56px" }}
          >
            <div className="text-center">
              <h1 className="text-3xl tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
                NFL PICK&rsquo;EM
              </h1>
              <p className="text-sm text-white/50 mt-1">
                Week {CURRENT_WEEK} &middot; {pickedCount} / {games.length} picked
              </p>
            </div>
            <StatPills stats={stats} lockedCount={lockedCount} blowoutCount={blowoutCount} />
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 items-stretch mt-8">
              {Array.from({ length: rowCount }).flatMap((_, i) => [
                renderGridCell(col1[i]),
                renderGridCell(col2[i]),
              ])}
            </div>
          </div>
        </div>
      )}

      {shareDebug && (
        <div className="fixed inset-x-3 bottom-3 z-50 rounded-lg bg-black text-white text-[11px] leading-relaxed font-mono p-3 max-h-[50vh] overflow-y-auto shadow-lg border border-white/20">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/50">share debug</span>
            <button onClick={() => setShareDebug(null)} className="text-white/70 underline">
              dismiss
            </button>
          </div>
          {shareDebug.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
