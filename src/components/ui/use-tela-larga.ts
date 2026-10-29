"use client";

import { useSyncExternalStore } from "react";

const CONSULTA = "(min-width: 1024px)";

/** Tela de computador (o "lg" do Tailwind, 1024 px)? Lido do navegador; no servidor, "não" (o celular primeiro). */
export function useTelaLarga(): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const mq = window.matchMedia(CONSULTA);
      mq.addEventListener("change", avisar);
      return () => mq.removeEventListener("change", avisar);
    },
    () => window.matchMedia(CONSULTA).matches,
    () => false,
  );
}
