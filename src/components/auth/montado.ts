import { useSyncExternalStore } from "react";

const semAssinatura = () => () => {};

/**
 * E793 A4 — "já montado no cliente?". No render do SERVIDOR e no 1º render do cliente (hidratação) o React usa o
 * getServerSnapshot → false; depois da hidratação, true. É o que garante que o 1º quadro saia só do contexto do servidor.
 */
export function useMontado(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false,
  );
}
