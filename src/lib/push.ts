"use client";

import { registerServiceWorker } from "./notifications";

const SUBSCRIBE_ENDPOINT = "/.netlify/functions/push-subscribe";
const UNSUBSCRIBE_ENDPOINT = "/.netlify/functions/push-unsubscribe";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** Registers the service worker, requests notification permission, creates
 * (or reuses) a real PushSubscription, and hands it to the server so a
 * scheduled job could dispatch to it later. Returns whether push ended up
 * enabled. */
export async function subscribeToPush(businessId: string): Promise<boolean> {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return false;

  const registration = await registerServiceWorker();
  if (!registration) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
  }

  try {
    const res = await fetch(SUBSCRIBE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId, subscription: subscription.toJSON() }),
    });
    return res.ok;
  } catch {
    // Subscription still exists locally even if the server call failed —
    // treat push as enabled; the next toggle can retry registering it.
    return true;
  }
}

export async function unsubscribeFromPush(businessId: string): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;

  await fetch(UNSUBSCRIBE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ businessId, endpoint: subscription.endpoint }),
  }).catch(() => {});
  await subscription.unsubscribe();
}
