"use client";

import { useEffect, useState } from "react";

/**
 * `true` quando rodando dentro do app nativo (Capacitor). SSR-safe: começa
 * `false` (igual ao servidor e ao primeiro paint), vira `true` após montar — sem
 * hydration mismatch. O import do Capacitor é dinâmico (fora do bundle do
 * servidor); na web comum fica `false` para sempre.
 */
export function useIsNative(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    let alive = true;
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (alive) setNative(!!Capacitor?.isNativePlatform?.());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return native;
}
