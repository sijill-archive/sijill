import { createClient } from "@supabase/supabase-js";

export function createRequestSupabase(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!match || !url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${match[1]}` } },
  });
}

export function bearerToken(authorization: string | null) {
  return authorization?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}
