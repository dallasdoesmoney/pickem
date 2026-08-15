import Link from "next/link";
import { TEAMS_SORTED } from "@/data/teams";

export default function PredictorLandingPage() {
  return (
    <main className="flex-1 px-4 pb-16 pt-10 max-w-4xl w-full mx-auto">
      <div className="text-center mb-10">
        <div className="text-xs text-white/45 tracking-[0.25em] mb-1">TEAM PICK&rsquo;EM</div>
        <h1 className="text-[clamp(2rem,8vw,3rem)] leading-none tracking-wide" style={{ fontFamily: "var(--font-display)" }}>
          PICK A TEAM
        </h1>
        <p className="text-white/50 text-sm mt-3">Predict every game on their schedule and see how you stack up against Vegas.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {TEAMS_SORTED.map((team) => (
          <Link
            key={team.abbr}
            href={`/predictor/${team.abbr.toLowerCase()}`}
            className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-colors px-4 py-6"
          >
            <img src={team.logo} alt="" className="h-14 w-14 object-contain" crossOrigin="anonymous" />
            <span className="text-sm text-center leading-tight" style={{ fontFamily: "var(--font-display)" }}>
              {team.city}
              <br />
              {team.name}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
