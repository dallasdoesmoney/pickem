import { stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Lets a plain Node test import the app's own TypeScript.
//
// Node runs TypeScript directly now (--experimental-strip-types), which is
// what makes it possible to test the real rules with no build step in
// front of them. Two things still stop it:
//
//   1. ESM needs a file extension. The app writes `./format`, because
//      bundlers do not.
//   2. The app writes `@/data/teams`, which is a tsconfig path alias that
//      Node knows nothing about.
//
// Both are resolution, not semantics, so a resolve hook is the whole fix.
// The alternative was importing app modules with explicit `.ts`
// extensions everywhere, which would be a change to shipping code made
// entirely for the benefit of tests.

const SRC = new URL("../../src/", import.meta.url);
// Ordered: a directory's index is the last thing to try, so `./format`
// prefers format.ts over format/index.ts.
const CANDIDATES = ["", ".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.tsx"];

async function firstThatExists(base) {
  for (const suffix of CANDIDATES) {
    const url = base + suffix;
    try {
      const stats = await stat(fileURLToPath(url));
      if (stats.isFile()) return url;
    } catch {
      // Not this one. A missing file is the expected case here, not an
      // error worth reporting - the whole point is to try several.
    }
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) {
    const found = await firstThatExists(new URL(specifier.slice(2), SRC).href);
    if (found) return next(found, context);
  }

  if (specifier.startsWith(".") && context.parentURL?.startsWith("file:")) {
    const parent = path.dirname(fileURLToPath(context.parentURL));
    const found = await firstThatExists(pathToFileURL(path.resolve(parent, specifier)).href);
    if (found) return next(found, context);
  }

  return next(specifier, context);
}
