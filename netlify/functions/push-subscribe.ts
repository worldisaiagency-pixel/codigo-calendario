import { getStore } from "@netlify/blobs";
import webpush from "web-push";

interface SubscribeBody {
  businessId: string;
  subscription: PushSubscriptionJSON;
}

const handler = async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let body: SubscribeBody;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { businessId, subscription } = body;
  if (!businessId || !subscription?.endpoint) {
    return new Response("Missing businessId or subscription", { status: 400 });
  }

  const store = getStore("push-subscriptions");
  const key = `${businessId}:${subscription.endpoint}`;
  await store.setJSON(key, { businessId, subscription });

  // Send one confirmation push immediately so the user gets proof the whole
  // pipeline (VAPID keys, subscription storage, actual delivery) works —
  // there's no scheduled dispatcher yet (see push.ts / plan notes), so this
  // is the only server-triggered push sent today.
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (publicKey && privateKey && subject) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    try {
      await webpush.sendNotification(
        subscription as unknown as webpush.PushSubscription,
        JSON.stringify({
          title: "Notificaciones activadas",
          body: "Te avisaremos de tus próximas citas.",
        })
      );
    } catch {
      // A failed confirmation push shouldn't fail the subscribe call — the
      // subscription is stored either way.
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
};

export default handler;
