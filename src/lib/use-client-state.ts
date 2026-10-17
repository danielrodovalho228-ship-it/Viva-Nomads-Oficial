"use client";

import { useSyncExternalStore } from "react";

/**
 * Leituras "só no navegador" sem setState dentro de effect (regra
 * react-hooks/set-state-in-effect). O servidor e a hidratação usam o snapshot
 * do servidor; depois o React troca para o valor real do navegador.
 */

const semAssinatura = () => () => {};

/** false no servidor/hidratação, true depois que o navegador assumiu. */
export function useMontado(): boolean {
  return useSyncExternalStore(
    semAssinatura,
    () => true,
    () => false
  );
}

/** Data de hoje (yyyy-mm-dd) no navegador; null no servidor/hidratação. */
export function useHoje(): string | null {
  return useSyncExternalStore(
    semAssinatura,
    () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    },
    () => null
  );
}

const ouvintes = new Set<() => void>();

function assinar(cb: () => void) {
  ouvintes.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    ouvintes.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch {
    return null;
  }
}

/** Valor bruto do localStorage: undefined no servidor/hidratação, null se vazio/bloqueado. */
export function useLocalStorageBruto(chave: string): string | null | undefined {
  return useSyncExternalStore(
    assinar,
    () => ler(chave),
    () => undefined
  );
}

/** Grava no localStorage (ignora cota/bloqueio) e avisa quem está lendo. */
export function gravarLocalStorageBruto(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* ignore */
  }
  ouvintes.forEach((cb) => cb());
}
