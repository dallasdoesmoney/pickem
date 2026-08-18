import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TIER_TEMPLATES, getTierTemplate } from "@/data/tierTemplates";
import TierListPageClient from "./TierListPageClient";

// Soft launch: the page is reachable by anyone with the URL, but nothing
// links to it and search engines are told to stay away, so it isn't
// discoverable while it's being tested. Remove this export (and add a nav
// entry) to actually launch it.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return Object.keys(TIER_TEMPLATES).map((list) => ({ list }));
}

export default async function Page({ params }: { params: Promise<{ list: string }> }) {
  const { list } = await params;
  const template = getTierTemplate(list);
  if (!template) notFound();

  return <TierListPageClient template={template} />;
}
