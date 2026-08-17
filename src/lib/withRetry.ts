// Retries a promise-returning function on transient, browser-level fetch
// failures - WebKit's "Load failed" / Chrome's "Failed to fetch" - which
// come from the underlying fetch() itself getting interrupted (e.g.
// Safari canceling an in-flight request when a tab is backgrounded or
// regains focus), not from the server. These are usually gone on the very
// next attempt. Real API errors (RLS denial, bad input, a genuine 4xx/5xx)
// fail the same way every time, so only this specific error shape is
// retried - anything else rethrows immediately.
function isTransientNetworkError(err: unknown): boolean {
  return err instanceof TypeError && /load failed|failed to fetch|network/i.test(err.message);
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 400): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransientNetworkError(err) || attempt === attempts) throw err;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  // Unreachable - the loop above always either returns or throws.
  throw new Error("withRetry: exhausted attempts");
}
