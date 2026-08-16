import { createClient } from "@supabase/supabase-js";

// One client for the whole app - every page here is a client component,
// so a plain browser client (session persisted to localStorage by the
// SDK itself) is all auth needs; no server-side session plumbing exists
// or is needed yet.
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
