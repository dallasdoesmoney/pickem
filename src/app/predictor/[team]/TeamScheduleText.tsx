import { TEAMS, TeamAbbr } from "@/data/teams";
import { getTeamSchedule } from "@/lib/teamSchedule";

// THE SCHEDULE, IN WORDS.
//
// The board above draws it as logo pills, which is the right way to pick
// eighteen games quickly and the wrong way to be read by anything that is
// not looking at it: a picture of the Chargers shield is not the string
// "Los Angeles Chargers". Fetched with no JavaScript, /predictor/kc came
// back as sixteen words - the site name, the nav, and a heading - on a
// page that ought to answer "Chiefs schedule predictions".
//
// So this is the same eighteen games, spelled out, below the board and
// visible to everybody. It is not a duplicate of the pills for a crawler's
// benefit; it is the part of the page a reader can actually copy, search
// within, or read out, and one of the two audiences happens to be Google.
//
// Rendered from the server page rather than from the client component, so
// it is in the first response no matter what the board is doing.
export function TeamScheduleText({ team }: { team: TeamAbbr }) {
  const t = TEAMS[team];
  const schedule = getTeamSchedule(team);
  const games = schedule.filter((row) => !("bye" in row)).length;
  const bye = schedule.find((row) => "bye" in row);

  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-16">
      <div className="border-t border-white/10 pt-7">
        <h2
          className="text-center text-[11px] tracking-[0.2em] text-white/40"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {`${t.city} ${t.name} ${new Date().getFullYear()} Schedule`.toUpperCase()}
        </h2>

        <p className="mx-auto mt-3 max-w-2xl text-center text-[13px] leading-relaxed text-white/50">
          Call all {games} games on the {t.city} {t.name} schedule and the board above adds up
          the record you just gave them
          {bye ? `. They are on bye in Week ${bye.week}` : ""}.
        </p>

        <ol className="mx-auto mt-5 grid max-w-2xl gap-x-8 gap-y-1.5 text-[13px] text-white/55 sm:grid-cols-2">
          {schedule.map((row) => {
            // "at" and "vs" rather than a home/away icon, because the
            // distinction is most of what a schedule means and it has to
            // survive being read as plain text.
            if ("bye" in row) {
              return (
                <li key={row.week} className="flex gap-3">
                  <span className="w-[4.2rem] shrink-0 text-white/35">Week {row.week}</span>
                  <span className="text-white/35">Bye</span>
                </li>
              );
            }
            const home = row.home === team;
            const other = TEAMS[home ? row.away : row.home];
            return (
              <li key={row.week} className="flex gap-3">
                <span className="w-[4.2rem] shrink-0 text-white/35">Week {row.week}</span>
                <span>
                  {home ? "vs" : "at"} {other.city} {other.name}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
