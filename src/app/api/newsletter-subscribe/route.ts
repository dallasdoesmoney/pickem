import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { subscribeEmailToBeehiiv } from "@/lib/beehiiv";

// Verifies the caller via their own Supabase access token and subscribes
// THAT account's own email - never a client-supplied one - so this
// endpoint can't be used to mass-subscribe arbitrary addresses to the
// newsletter. A fresh client (not the shared browser singleton) since
// this runs server-side per-request, keyed to the caller's token rather
// than any stored session.
export async function POST(request: NextRequest) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error: authError } = await supabase.auth.getUser(token);
  if (authError || !data.user?.email) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  try {
    await subscribeEmailToBeehiiv(data.user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Newsletter subscribe failed", err);
    return NextResponse.json({ error: "Couldn't subscribe to the newsletter" }, { status: 502 });
  }
}
