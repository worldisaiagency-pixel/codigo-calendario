"use client";

const SESSION_KEY = "peluqueria:session";

export interface BusinessSession {
  kind?: "business"; // absent on sessions saved before the admin role existed
  businessId: string;
  negocio: string;
  usuario: string;
}

export interface AdminSession {
  kind: "admin";
}

export type Session = BusinessSession | AdminSession;

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
}
