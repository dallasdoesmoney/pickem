import type { Metadata } from "next";

// NOT LINKED FROM ANYWHERE, and not indexed - same as /versus, for the
// same reason. It is being built in the open on a live site, so it needs
// to be reachable by URL without being findable: no nav entry, no sitemap
// entry, and noindex so a crawler that stumbles on the URL from a stream
// overlay or a shared link does not put a half-finished game into search
// results under the site's name.
export const metadata: Metadata = {
  // Bare, because the root layout appends "| Sideline Brew".
  title: "Wavelength",
  robots: { index: false, follow: false },
};

export default function WavelengthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
