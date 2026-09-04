import type { Metadata } from "next";

// A scratch page for choosing between four animations, reachable by URL
// so it can be looked at on a phone, linked from nowhere, and kept out
// of search - the same arrangement the rest of /versus has.
//
// This goes with whichever variants lose.
export const metadata: Metadata = {
  title: "Versus animation ideas",
  robots: { index: false, follow: false },
};

export default function AnimationIdeasLayout({ children }: { children: React.ReactNode }) {
  return children;
}
