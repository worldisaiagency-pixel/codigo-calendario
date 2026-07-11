"use client";

import { useEffect, useState } from "react";
import { dataProvider } from "@/lib/data";
import type { Business } from "@/lib/data";
import { useAppStore } from "@/lib/store";
import { clearSession, getSession, setSession } from "./session";

type AuthStatus = "loading" | "authenticated" | "authenticated-admin" | "unauthenticated";

/** Resumes a saved session on mount (re-fetching the business so config is
 * always current), and exposes login/logout for the login screen and the
 * "Cerrar sesión" control. */
export function useAuth() {
  const loadBusiness = useAppStore((s) => s.loadBusiness);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const session = getSession();
      if (!session) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }
      if (session.kind === "admin") {
        if (!cancelled) setStatus("authenticated-admin");
        return;
      }
      try {
        const businesses = await dataProvider.listBusinesses();
        const match = businesses.find((b) => b.id === session.businessId);
        if (!match) {
          clearSession();
          if (!cancelled) setStatus("unauthenticated");
          return;
        }
        loadBusiness(match);
        if (!cancelled) setStatus("authenticated");
      } catch {
        // Sheet unreachable right now — don't drop the session, just let the
        // login screen show; a reload will retry the restore.
        if (!cancelled) setStatus("unauthenticated");
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function login(business: Business) {
    setSession({
      kind: "business",
      businessId: business.id,
      negocio: business.name,
      usuario: business.username,
    });
    loadBusiness(business);
    setStatus("authenticated");
  }

  function loginAdmin() {
    setSession({ kind: "admin" });
    setStatus("authenticated-admin");
  }

  function logout() {
    clearSession();
    // Simplest safe reset: table references, subscriptions, and in-memory
    // state are all scoped to the loaded business — a reload guarantees no
    // leftover state leaks into the next login on this device.
    if (typeof window !== "undefined") window.location.reload();
  }

  return { status, login, loginAdmin, logout };
}
