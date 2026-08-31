import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TEAMS, TeamAbbr } from "@/data/teams";
import PredictorPageClient from "./PredictorPageClient";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/structuredData";

// Thirty-two pages that each answer a real search - "Chiefs record
// prediction" and thirty-one like it. They were already being generated
// at build time; they simply inherited the site's generic card, so all
// thirty-two looked identical to each other and to the home page.
export async function generateMetadata({ params }: { params: Promise<{ team: string }> }): Promise<Metadata> {
  const { team } = await params;
  const abbr = team.toUpperCase() as TeamAbbr;
  const t = TEAMS[abbr];
  if (!t) return {};
  const name = `${t.city} ${t.name}`;
  const title = `${name} Record Predictor`;
  const description = `Call every game on the ${name} schedule and see the record you just gave them.`;
  return {
    title: `${title} - Sideline Brew`,
    description,
    alternates: { canonical: `/predictor/${team.toLowerCase()}` },
    openGraph: { type: "website", siteName: "Sideline Brew", title, description, url: `/predictor/${team.toLowerCase()}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export function generateStaticParams() {
  return Object.keys(TEAMS).map((abbr) => ({ team: abbr.toLowerCase() }));
}

export default async function Page({ params }: { params: Promise<{ team: string }> }) {
  const { team } = await params;
  const abbr = team.toUpperCase() as TeamAbbr;
  if (!(abbr in TEAMS)) notFound();

  const t = TEAMS[abbr];
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Record Predictor", path: "/predictor" },
          { name: `${t.city} ${t.name} Record Predictor`, path: `/predictor/${team.toLowerCase()}` },
        ])}
      />
      <PredictorPageClient trackedTeam={abbr} />
    </>
  );
}
