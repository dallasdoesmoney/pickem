import { notFound } from "next/navigation";
import { TEAMS, TeamAbbr } from "@/data/teams";
import PredictorPageClient from "./PredictorPageClient";

export function generateStaticParams() {
  return Object.keys(TEAMS).map((abbr) => ({ team: abbr.toLowerCase() }));
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const abbr = team.toUpperCase() as TeamAbbr;
  if (!(abbr in TEAMS)) notFound();

  return <PredictorPageClient trackedTeam={abbr} />;
}
