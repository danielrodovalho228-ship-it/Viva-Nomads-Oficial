"use client";

import { useSyncExternalStore } from "react";

/** Tela de toque (celular/tablet)? Lido do navegador; no servidor, "não" (o campo do computador). */
export function useToque(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia("(pointer: coarse)");
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia("(pointer: coarse)").matches,
    () => false,
  );
}
