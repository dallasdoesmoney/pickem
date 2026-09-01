import type { Metadata } from "next";

// A scratch page for choosing between five designs, reachable by URL so
// it can be looked at on a phone, linked from nowhere, and kept out of
// search - the same arrangement /versus has while it is being built.
//
// This goes with the four losing variants once one is picked.
export const metadata: Metadata = {
  title: "Lock ideas",
  robots: { index: false, follow: false },
};

export default function LockIdeasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
