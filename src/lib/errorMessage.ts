// Not every rejection is a real Error instance - Supabase's PostgrestError
// does extend Error, but some client-level failures (network errors,
// thrown plain objects) don't, and String(plainObject) silently produces
// "[object Object]" instead of anything useful.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return String(err);
}
