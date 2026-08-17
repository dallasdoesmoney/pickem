const BEEHIIV_API_BASE = "https://api.beehiiv.com/v2";

// Server-only - BEEHIIV_API_KEY must never reach the browser. Only ever
// called from the /api/newsletter-subscribe route handler, never a
// client component. reactivate_existing/send_welcome_email make this
// safe to call more than once for the same email (matters since
// resolveSession retries on failure rather than tracking attempts).
export async function subscribeEmailToBeehiiv(email: string): Promise<void> {
  const apiKey = process.env.BEEHIIV_API_KEY;
  const publicationId = process.env.BEEHIIV_PUBLICATION_ID;
  if (!apiKey || !publicationId) {
    throw new Error("Beehiiv is not configured (missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID)");
  }

  const res = await fetch(`${BEEHIIV_API_BASE}/publications/${publicationId}/subscriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      reactivate_existing: false,
      send_welcome_email: true,
      utm_source: "pickem-signup",
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Beehiiv subscribe failed (${res.status}): ${detail}`);
  }
}
