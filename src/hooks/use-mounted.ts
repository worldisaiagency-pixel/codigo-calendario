"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only once the component has mounted in the browser. Used to defer
 * clock/locale-dependent rendering past the server-rendered first paint. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
