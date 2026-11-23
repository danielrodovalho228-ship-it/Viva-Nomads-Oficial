"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CHAVE_RELEITURA_INICIO, ESPERA_RELEITURA_INICIO_MS, deveRelerOInicio } from "@/lib/painel/sem-leitura";

/**
 * E1093: o Início com leitura falhada relê-se sozinho uma vez (router.refresh: uma carga nova do servidor, sem perder a
 * rolagem nem o estado da casca). A regra (uma vez a cada 10 s por aba) mora em deveRelerOInicio. Não desenha nada: o
 * aviso do topo continua a dizer o que não foi lido enquanto a carga nova não chega.
 */
export function RelerInicio() {
  const router = useRouter();
  useEffect(() => {
    let ultima: number | null = null;
    try {
      const guardado = window.sessionStorage.getItem(CHAVE_RELEITURA_INICIO);
      ultima = guardado === null ? null : Number(guardado);
    } catch {
      /* sem armazenamento: relê uma vez nesta montagem */
    }
    const agora = Date.now();
    if (!deveRelerOInicio(ultima, agora)) return;
    try {
      window.sessionStorage.setItem(CHAVE_RELEITURA_INICIO, String(agora));
    } catch {
      /* segue: o efeito só corre uma vez por montagem */
    }
    const t = window.setTimeout(() => router.refresh(), ESPERA_RELEITURA_INICIO_MS);
    return () => window.clearTimeout(t);
  }, [router]);
  return null;
}
