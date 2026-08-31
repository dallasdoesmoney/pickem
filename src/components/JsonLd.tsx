// A <script type="application/ld+json"> that renders on the SERVER.
//
// Which is the whole point: structured data is read by things that fetch
// the HTML and stop, so a block injected after hydration is a block most
// of its audience never sees.
//
// JSON.stringify rather than a template literal, and `<` escaped on the
// way out: schema fields carry names people typed, and a display name
// containing "</script>" would otherwise end the tag early and put the
// rest of the payload into the document as markup.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
