import type { Metadata } from "next";

// A scratch page for choosing between five indicators, reachable by URL
// so it can be looked at on a phone, linked from nowhere, and kept out
// of search - the same arrangement the rest of /versus has while it is
// being built.
//
// This goes with the four losing variants once one is picked.
export const metadata: Metadata = {
  title: "Turn indicator ideas",
  robots: { index: false, follow: false },
};

export default function TurnIdeasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
