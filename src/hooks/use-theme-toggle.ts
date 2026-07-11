"use client";

import { useTheme } from "next-themes";
import { useMounted } from "./use-mounted";

/** Simple light/dark toggle (no "system" option once the user touches it) —
 * `mounted` guards against a hydration mismatch, since the real theme is
 * only known client-side (next-themes reads localStorage). */
export function useThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return { isDark, toggle, mounted };
}
