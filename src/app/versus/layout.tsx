import type { Metadata } from "next";

// NOT LINKED FROM ANYWHERE, and not indexed.
//
// The auction game is being built in the open on a live site, so it needs
// to be reachable by URL without being findable. No nav entry, no sitemap
// entry, and noindex so that a crawler which stumbles on the URL - from a
// stream overlay, a shared link, a browser's history sync - does not put
// a half-finished game into search results under the site's name.
//
// Take this out when the game ships and gets a nav entry, along with the
// sitemap line that will replace it.
export const metadata: Metadata = {
  title: "Versus - Sideline Brew",
  robots: { index: false, follow: false },
};

export default function VersusLayout({ children }: { children: React.ReactNode }) {
  return children;
}
