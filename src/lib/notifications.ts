"use client";

const STORAGE_KEY = "peluqueria:notifications-enabled";
export const REMINDER_LEAD_MIN = 10;

export function notificationsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function isNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function setNotificationsEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function showReminderNotification(params: {
  dogName: string;
  ownerName: string;
  timeLabel: string;
  service: string;
}) {
  if (typeof window === "undefined" || Notification.permission !== "granted") return;
  const title = `${params.dogName} en ${REMINDER_LEAD_MIN} minutos`;
  const options: NotificationOptions = {
    body: `${params.timeLabel} · ${params.service} · ${params.ownerName}`,
    tag: `appt-${params.dogName}-${params.timeLabel}`,
  };
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
  if (reg) {
    reg.showNotification(title, options).catch(() => new Notification(title, options));
  } else {
    new Notification(title, options);
  }
}
