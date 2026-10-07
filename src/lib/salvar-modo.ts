"use client";

import { setPreferredMode } from "@/lib/data/mode-actions";
import { gravarPendente, limparPendente, type Modo } from "@/lib/modo-pendente";

const armazem = () => (typeof window === "undefined" ? null : window.localStorage);

/**
 * Grava o modo no perfil sem perder a troca se a página recarregar no meio
 * (bug 6 da L2): anota a escolha antes e só limpa quando o servidor confirma.
 */
export async function salvarModo(modo: Modo): Promise<boolean> {
  gravarPendente(armazem(), modo);
  const r = await setPreferredMode(modo).catch(() => ({ ok: false }));
  if (r.ok) limparPendente(armazem(), modo);
  return r.ok;
}
