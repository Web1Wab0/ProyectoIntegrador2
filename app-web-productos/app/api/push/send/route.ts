import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import webpush from "web-push";

export async function POST(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { notification_id?: string } | null;
  const notificationId = body?.notification_id;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!notificationId || !url || !serviceKey || !publicKey || !privateKey || !subject) {
    return NextResponse.json({ error: "Configuración incompleta." }, { status: 503 });
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: notification } = await supabase
    .from("notifications")
    .select("id,user_id,title,message,href,event_key")
    .eq("id", notificationId)
    .maybeSingle();
  if (!notification) return NextResponse.json({ delivered: 0 });

  const [{ data: preferences }, { data: subscriptions }] = await Promise.all([
    supabase.from("notification_preferences").select("*").eq("user_id", notification.user_id).maybeSingle(),
    supabase.from("push_subscriptions").select("*").eq("user_id", notification.user_id),
  ]);
  if (!preferences?.push_enabled || !subscriptions?.length) {
    return NextResponse.json({ delivered: 0 });
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  let delivered = 0;
  await Promise.all(subscriptions.map(async (subscription) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify({
          title: notification.title,
          message: notification.message,
          href: notification.href,
          tag: notification.event_key,
        })
      );
      delivered += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
  }));
  return NextResponse.json({ delivered });
}
