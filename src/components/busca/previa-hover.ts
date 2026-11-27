"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * E442 (regressão): passar o mouse sobre o PREÇO no mapa da busca abre o cartão do imóvel (foto, título, valor/mês,
 * clique leva ao anúncio) — o mesmo cartão do clique. Desde a ordem ca0e7dad (14/10, commit 41b55043d) o hover só
 * destacava o pin e sobrava a etiqueta nativa (title) do Leaflet. Regras:
 *  - só com mouse (hover de verdade); no toque, o toque no preço já abre o cartão (clique);
 *  - ao sair do pin, o cartão espera ESPERA_PREVIA_MS antes de fechar — dá tempo de levar o mouse até ele e clicar;
 *    entrar no cartão cancela o fechamento; sair dele fecha.
 */
export const ESPERA_PREVIA_MS = 250;

export function temHoverDeVerdade(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

export function usePreviaNoHover(espera = ESPERA_PREVIA_MS) {
  const [id, setId] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const api = useMemo(() => {
    const cancelar = () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    };
    return {
      /** Mouse entrou no preço: abre a prévia (só com hover de verdade). */
      entrarPin: (pid: string) => {
        if (!temHoverDeVerdade()) return;
        cancelar();
        setId(pid);
      },
      /** Mouse saiu do preço ou do cartão: fecha depois da espera. */
      sair: () => {
        cancelar();
        timer.current = window.setTimeout(() => setId(null), espera);
      },
      /** Mouse entrou no cartão: mantém aberto. */
      manter: cancelar,
      /** Fechar já (×, Esc, clique no mapa). */
      limpar: () => {
        cancelar();
        setId(null);
      },
    };
  }, [espera]);
  useEffect(() => () => api.manter(), [api]);
  return { id, ...api };
}
