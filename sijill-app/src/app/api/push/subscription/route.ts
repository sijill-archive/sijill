import { NextResponse } from "next/server";
import { bearerToken, createRequestSupabase } from "@/lib/supabase/api-auth";

export const dynamic = "force-dynamic";

async function getUser(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  const supabase = createRequestSupabase(request.headers.get("authorization"));
  if (!token || !supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? null : { supabase, user };
}

export async function POST(request: Request) {
  const auth = await getUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { endpoint?: unknown; subscription?: unknown } | null;
  if (typeof payload?.endpoint !== "string" || !payload.endpoint.startsWith("https://") || !payload.subscription || typeof payload.subscription !== "object") {
    return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
  }
  const { error } = await auth.supabase.from("sijill_push_subscriptions").upsert({
    user_id: auth.user.id,
    endpoint: payload.endpoint,
    subscription: payload.subscription,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,endpoint" });
  if (error) return NextResponse.json({ error: "Could not save push subscription." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await getUser(request);
  if (!auth) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const payload = await request.json().catch(() => null) as { endpoint?: unknown } | null;
  if (typeof payload?.endpoint !== "string") return NextResponse.json({ error: "Invalid endpoint." }, { status: 400 });
  const { error } = await auth.supabase.from("sijill_push_subscriptions").delete().eq("user_id", auth.user.id).eq("endpoint", payload.endpoint);
  if (error) return NextResponse.json({ error: "Could not remove push subscription." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
