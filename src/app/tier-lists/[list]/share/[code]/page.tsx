import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTierTemplate } from "@/data/tierTemplates";
import SharedTierListClient from "./SharedTierListClient";

// Shared snapshots stay out of search results permanently, not just
// during the soft launch - these are personal links people pass around,
// not pages that should surface in a search for someone's name.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Share codes are created at runtime, so this route can't be statically
// enumerated the way the template route is - the snapshot is fetched
// client-side by code.
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

export default async function Page({ params }: { params: Promise<{ list: string; code: string }> }) {
  const { list, code } = await params;
  const template = getTierTemplate(list);
  if (!template) notFound();

  return <SharedTierListClient template={template} code={code} />;
}
