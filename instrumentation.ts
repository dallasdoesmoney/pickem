import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, initSentry } from "@/lib/sentry";

// SERVER-side errors, which nothing was watching at all.
//
// PostHog has captured client exceptions since it went in
// (capture_exceptions in instrumentation-client.ts), so a crash in the
// browser was already visible. Nothing was watching the server - and the
// creator profile now renders there, which is the first page whose data
// fetch can fail before a browser is involved.
//
// Runs once per server instance, in both the node and edge runtimes.
export async function register() {
  initSentry();
}

// Next hands every server-side error here - render errors, route handler
// throws, and the ones React reprocesses on the way out.
export const onRequestError: typeof Sentry.captureRequestError = (...args) => {
  // Without a DSN there is no client for this to report to. Sentry's own
  // helpers are no-ops in that state, but saying so here means the "does
  // nothing until Dallas adds the variable" promise is visible at the
  // entry point rather than three files away.
  if (!SENTRY_DSN) return;
  return Sentry.captureRequestError(...args);
};
