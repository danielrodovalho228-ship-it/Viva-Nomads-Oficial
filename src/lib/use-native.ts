"use client";

import { useEffect, useState } from "react";

/**
 * `true` quando o site roda DENTRO do app (Expo, iPhone e Android). Usa a marca
 * `<html data-app="1">`, posta antes da 1ª pintura (lib/app-mode). SSR-safe:
 * começa `false` (igual ao servidor) e vira `true` depois de montar.
 */
export function useIsNative(): boolean {
  const [native, setNative] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNative(document.documentElement.getAttribute("data-app") === "1");
  }, []);
  return native;
}
