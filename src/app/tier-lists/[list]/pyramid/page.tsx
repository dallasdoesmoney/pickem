import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TIER_TEMPLATES, getTierTemplate } from "@/data/tierTemplates";
import { PyramidBoard, RANKED } from "@/components/tierList/PyramidBoard";

// Not launched. Nothing anywhere links here - not the hub, not the
// board's own controls, not the nav - and search engines are told to stay
// away, so the only way in is knowing the URL. Wiring pyramid mode into
// the real editor is a separate change; this exists to be looked at and
// argued with first.
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

  const others = Object.values(TIER_TEMPLATES).filter((t) => t.slug !== template.slug);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-20">
      <div className="mb-5 flex justify-center">
        <span
          className="rounded-full border border-amber-300/35 bg-amber-300/10 px-3.5 py-1.5 text-[10px] tracking-[0.16em] text-amber-200/90"
          style={{ fontFamily: "var(--font-display)" }}
        >
          PREVIEW · NOT LINKED ANYWHERE
        </span>
      </div>

      <header className="mb-8 text-center">
        <div className="mb-1.5 text-xs tracking-[0.25em] text-white/45">PYRAMID MODE</div>
        <h1
          className="text-[clamp(1.6rem,6vw,2.5rem)] leading-none tracking-wide"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {template.title.toUpperCase()}
        </h1>
        <p className="mt-3 text-sm text-white/50">
          Top {RANKED} in four rows. Everything else misses the cut.
        </p>
      </header>

      {/* Its own board, in its own storage - this is a preview, and it must
          not be able to touch a list somebody actually saved. */}
      <PyramidBoard template={template} />

      <div className="mt-12 border-t border-white/10 pt-6 text-center">
        <div className="mb-3 text-[10px] tracking-[0.16em] text-white/35" style={{ fontFamily: "var(--font-display)" }}>
          TRY ANOTHER
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {others.map((t) => (
            <Link
              key={t.slug}
              href={`/tier-lists/${t.slug}/pyramid`}
              className="rounded-full border border-white/15 px-4 py-2 text-xs text-white/60 transition-colors hover:border-white/40 hover:text-white"
            >
              {t.title}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
