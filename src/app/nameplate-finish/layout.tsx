import type { Metadata } from "next";

// A scratch page for choosing between four win screens, reachable by URL
// so it can be looked at on a phone, linked from nowhere, and kept out
// of search - the same arrangement every other mockup here has had.
//
// This goes with the three losing variants once one is picked.
export const metadata: Metadata = {
  title: "Win screen ideas",
  robots: { index: false, follow: false },
};

export default function NameplateFinishLayout({ children }: { children: React.ReactNode }) {
  return children;
}
