import { TEAMS, TeamAbbr } from "@/data/teams";
import { getTeamSchedule } from "@/lib/teamSchedule";
import { Disclosure } from "@/components/Disclosure";

// THE SCHEDULE, IN WORDS.
//
// The board above draws it as logo pills, which is the right way to pick
// eighteen games quickly and the wrong way to be read by anything that is
// not looking at it: a picture of the Chargers shield is not the string
// "Los Angeles Chargers". Fetched with no JavaScript, /predictor/kc came
// back as sixteen words - the site name, the nav, and a heading - on a
// page that ought to answer "Chiefs schedule predictions".
//
// Behind a disclosure, because most people arriving here have the board
// and do not need the same eighteen games spelled out underneath it. The
// ones who do are worth a line: a schedule you can read, copy or search
// within is a real thing to want from a page whose main view is logos.
// <details> keeps the words in the HTML either way.
export function TeamScheduleText({ team }: { team: TeamAbbr }) {
  const t = TEAMS[team];
  const schedule = getTeamSchedule(team);
  const games = schedule.filter((row) => !("bye" in row)).length;
  const bye = schedule.find((row) => "bye" in row);

  return (
    <Disclosure label={`${t.city} ${t.name} schedule`}>
      <p className="text-[13px] leading-relaxed text-white/50">
        All {games} games on the {t.city} {t.name} schedule, in order. Call each one on the
        board above and it adds up the record you just gave them
        {bye ? `. They are on bye in Week ${bye.week}` : ""}.
      </p>

      <ol className="mt-4 grid gap-x-8 gap-y-1.5 text-[13px] text-white/55 sm:grid-cols-2">
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
    </Disclosure>
  );
}
