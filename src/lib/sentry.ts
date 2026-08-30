import type { BrowserOptions, NodeOptions } from "@sentry/nextjs";

// One place that decides whether error monitoring is on, so the three
// entry points (client, node, edge) cannot drift apart.
//
// ABSENT DSN MEANS ABSENT SDK. Not "initialised with sampling at zero":
// the import itself is behind the guard, so with no DSN the browser never
// downloads the SDK at all - and since NEXT_PUBLIC_SENTRY_DSN is inlined
// at build time, the branch is a compile-time constant and the chunk can
// be dropped outright. That is what makes this safe to merge before
// Dallas has a Sentry project: not one byte changes for a player until
// the variable exists.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function initSentry(extra: NodeOptions | BrowserOptions = {}) {
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: SENTRY_DSN,
    // Errors only, to start. Performance tracing is a separate decision
    // with a separate bill, and turning it on later is one line.
    tracesSampleRate: 0,
    // What makes a deploy preview's noise separable from the live site's.
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    ...extra,
  });
}

// What a swallowed error should do instead of vanishing.
//
// The swallow is usually RIGHT for the player - a stats panel that fails
// to load should not take the game down with it - but the silence is not
// right for us: every one of these was a failure nobody would ever hear
// about. So: console always, because that is what a developer with the
// page open sees, and Sentry when it is configured, because that is what
// somebody who is not watching sees.
//
// `where` is a short stable label, not a message, so the same failure
// groups together in the issue list however its message varies.
//
// Deliberately not async and never awaited: a reporting call must not be
// able to change the order of anything in the path it is reporting on.
export function reportError(where: string, err: unknown) {
  console.error(`[${where}]`, err);
  if (!SENTRY_DSN) return;
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      tags: { where },
    });
  });
}
