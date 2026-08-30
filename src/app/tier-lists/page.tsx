import type { Metadata } from "next";
import { TIER_TEMPLATES } from "@/data/tierTemplates";
import TierListsIndexClient from "./TierListsIndexClient";

// THE SOFT LAUNCH IS OVER, and this export is what was left of it.
//
// The instruction the old comment left was "drop this when the nav entry
// goes in". The nav entry went in - NavShell.tsx line 44, "Tier Lists",
// matchPrefix /tier-lists - so the condition it named has been met and
// the noindex was outliving the reason for it.
//
// This is the page "NFL tier list" should find, and it could not.
export const metadata: Metadata = {
  title: "NFL Tier Lists - Sideline Brew",
  description:
    "Rank NFL teams, quarterbacks, running backs, receivers, tight ends, kickers and head coaches. Drag them into tiers and share the board.",
  openGraph: {
    type: "website",
    siteName: "Sideline Brew",
    title: "NFL Tier Lists",
    description: "Rank teams, quarterbacks, receivers and more. Drag them into tiers and share the board.",
    url: "/tier-lists",
  },
  twitter: { card: "summary_large_image", title: "NFL Tier Lists" },
};

export default function Page() {
  // Templates are a build-time constant, so the catalogue half of this
  // page is static; only "my saved lists" needs the client and a session.
  return <TierListsIndexClient templates={Object.values(TIER_TEMPLATES)} />;
}
