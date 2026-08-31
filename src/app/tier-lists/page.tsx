import type { Metadata } from "next";
import { TIER_TEMPLATES } from "@/data/tierTemplates";
import TierListsIndexClient from "./TierListsIndexClient";

// Still soft-launched, same as the editor: reachable by URL, but not
// linked from the nav and not indexed. Drop this export when the nav
// entry goes in.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function Page() {
  // Templates are a build-time constant, so the catalogue half of this
  // page is static; only "my saved lists" needs the client and a session.
  return <TierListsIndexClient templates={Object.values(TIER_TEMPLATES)} />;
}
