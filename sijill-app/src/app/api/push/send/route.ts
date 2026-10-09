import { NextResponse } from "next/server";
import webpush from "web-push";
import { bearerToken, createRequestSupabase } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = bearerToken(request.headers.get("authorization"));
  const supabase = createRequestSupabase(request.headers.get("authorization"));
  if (!token || !supabase) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });

  const { data: role } = await supabase.from("sijill_user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (role?.role !== "owner") return NextResponse.json({ error: "Owner access is required." }, { status: 403 });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return NextResponse.json({ error: "Push notifications are not configured." }, { status: 503 });

  const payload = await request.json().catch(() => null) as { notificationId?: unknown } | null;
  if (typeof payload?.notificationId !== "string") return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  const [{ data: notice, error: noticeError }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
    supabase.from("sijill_broadcast_notifications").select("id,title,body").eq("id", payload.notificationId).eq("status", "published").maybeSingle(),
    supabase.from("sijill_push_subscriptions").select("endpoint,subscription"),
  ]);
  if (noticeError || !notice) return NextResponse.json({ error: "Published notification not found." }, { status: 404 });
  if (subscriptionsError) return NextResponse.json({ error: "Could not load registered devices." }, { status: 500 });
  if (!subscriptions?.length) return NextResponse.json({ sent: 0, expired: 0, total: 0 });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const message = JSON.stringify({ title: notice.title, body: notice.body, id: notice.id, url: "/" });
  const results = await Promise.allSettled(subscriptions.map((row) =>
    webpush.sendNotification(row.subscription as webpush.PushSubscription, message),
  ));
  const expiredEndpoints = subscriptions.filter((_, index) => {
    const result = results[index];
    return result.status === "rejected" && [404, 410].includes(Number((result.reason as { statusCode?: number })?.statusCode));
  }).map((row) => row.endpoint);
  if (expiredEndpoints.length) await supabase.from("sijill_push_subscriptions").delete().in("endpoint", expiredEndpoints);
  const sent = results.filter((result) => result.status === "fulfilled").length;
  return NextResponse.json({ sent, expired: expiredEndpoints.length, total: subscriptions.length });
}
