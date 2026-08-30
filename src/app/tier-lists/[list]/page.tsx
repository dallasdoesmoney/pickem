import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TIER_TEMPLATES, getTierTemplate } from "@/data/tierTemplates";
import TierListPageClient from "./TierListPageClient";
import { TierListIntro } from "./TierListIntro";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/structuredData";

// Its own card per template, replacing the soft-launch noindex - see the
// note on the index page for why that came off.
//
// Seven routes that each answer a different search, and until now all
// seven were invisible and would have unfurled as the home page anyway.
// The title comes from the template rather than being written out here,
// so an eighth list needs no edit to this file.
export async function generateMetadata({ params }: { params: Promise<{ list: string }> }): Promise<Metadata> {
  const { list } = await params;
  const template = getTierTemplate(list);
  if (!template) return {};
  const title = `${template.title} Tier List`;
  return {
    title: `${title} - Sideline Brew`,
    description: `${template.tagline}. Drag them into tiers, save your board and share it.`,
    alternates: { canonical: `/tier-lists/${list}` },
    openGraph: {
      type: "website",
      siteName: "Sideline Brew",
      title,
      description: template.tagline,
      url: `/tier-lists/${list}`,
    },
    twitter: { card: "summary_large_image", title, description: template.tagline },
  };
}

export function generateStaticParams() {
  return Object.keys(TIER_TEMPLATES).map((list) => ({ list }));
}

export default async function Page({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const template = getTierTemplate(list);
  if (!template) notFound();

  // The editor reads ?id= through useSearchParams, which needs a Suspense
  // boundary for this route to stay statically prerendered.
  //
  // The fallback lands in the prerendered HTML, so it is what anything
  // that does not run JavaScript sees. Same content the client component
  // shows before its saved board loads - see TierListIntro.
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Tier Lists", path: "/tier-lists" },
          { name: `${template.title} Tier List`, path: `/tier-lists/${list}` },
        ])}
      />
      <Suspense fallback={<TierListIntro template={template} />}>
        <TierListPageClient template={template} />
      </Suspense>
    </>
  );
}
