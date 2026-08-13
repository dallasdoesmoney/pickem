"use client";

import { useState } from "react";
import { CURRENT_WEEK, GAMES_BY_WEEK } from "@/data/games";
import { GameCard } from "@/components/GameCard";
import { usePicks, MAX_LOCKS, MAX_BLOWOUTS } from "@/hooks/usePicks";
import { groupGamesByDay } from "@/lib/groupGames";
import { FlowItem, PickStats, flatten, splitIntoColumns, computePickStats } from "@/lib/pickLayout";
import { renderShareImage } from "@/lib/shareImage";

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

export default function Home() {
  const games = GAMES_BY_WEEK[CURRENT_WEEK];
  const { picks, setPick, specials, cycleSpecial, loaded } = usePicks(CURRENT_WEEK);
  const pickedCount = Object.keys(picks).length;
  const lockedCount = Object.values(specials).filter((s) => s === "lock").length;
  const blowoutCount = Object.values(specials).filter((s) => s === "blowout").length;
  const canAddSpecial = lockedCount < MAX_LOCKS || blowoutCount < MAX_BLOWOUTS;
  const groups = groupGamesByDay(games);
  const stats = computePickStats(games, picks);
  const [sharing, setSharing] = useState(false);
  const [shareDebug, setShareDebug] = useState<string[] | null>(null);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    const log: string[] = [];
    try {
      log.push(`ua: ${navigator.userAgent}`);
      const blob = await renderShareImage({ games, groups, picks, specials, week: CURRENT_WEEK });
      log.push(`canvas render: ${Math.round(blob.size / 1024)}kb png`);

      const filename = `pickem-week-${CURRENT_WEEK}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      function download() {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        log.push("download: triggered");
      }

      // Desktop Chrome (especially macOS) frequently advertises file
      // sharing support and then aborts immediately with no working share
      // target - confirmed on-device. Coarse pointer (touch) is a much
      // more reliable signal for "has a real native share sheet" than
      // canShare() alone, which the API spec never ties to that.
      const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const canShareFiles = isTouchPrimary && !!navigator.canShare?.({ files: [file] });
      log.push(`touch primary: ${isTouchPrimary}, canShare files: ${canShareFiles}`);

      if (canShareFiles) {
        try {
          await navigator.share({
            files: [file],
            title: "NFL Pick'em",
            text: `My Week ${CURRENT_WEEK} picks`,
          });
          log.push("share sheet: opened");
        } catch (shareErr) {
          const cancelled = shareErr instanceof Error && shareErr.name === "AbortError";
          log.push(cancelled ? "share sheet: cancelled, falling back to download" : `share sheet failed: ${String(shareErr)}, falling back to download`);
          download();
        }
      } else {
        download();
      }
    } catch (err) {
      log.push(`ERROR: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`);
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
