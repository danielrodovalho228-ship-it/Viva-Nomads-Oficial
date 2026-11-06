"use client";

import { useEffect } from "react";
import { useAuthStore, type ViewMode } from "@/lib/store";
import { aplicarReleitura, decidirModoInicial, ESPERAS_RELEITURA_MS, lerPendente, limparPendente, precisaReler } from "@/lib/modo-pendente";
import { resolveInitialMode } from "@/lib/data/mode-actions";
import { salvarModo } from "@/lib/salvar-modo";

/**
 * Aplica a decisão AUTORITATIVA do servidor sobre o modo inicial (reteste QA
 * item 1). O layout do painel resolve o modo no servidor (preferência do perfil
 * → papel → conta nova) e passa aqui; isto corrige um localStorage stale e
 * impede que aba nova / deep-link caia em Inquilino por padrão para quem é
 * proprietário. `null` (conta nova sem papel, ou demo sem Supabase) = não força
 * nada — a pergunta de primeiro acesso decide.
 *
 * Renderizado ANTES da casca na árvore: o efeito roda antes do guard de rota da
 * shell, então o modo já entra correto na primeira decisão.
 *
 * Exceção (bug 6 da L2): uma troca feita há pouco que o servidor ainda não
 * confirmou vence o valor do servidor e é regravada — senão recarregar ou abrir
 * outra aba logo depois de trocar desfazia a troca.
 */
export function ModeInitializer({ initialMode, indisponivel = false }: { initialMode: ViewMode | null; indisponivel?: boolean }) {
  useEffect(() => {
    const servidor = initialMode === "owner" || initialMode === "tenant" ? initialMode : null;
    const { modo, regravar } = decidirModoInicial(servidor, lerPendente(window.localStorage));
    // E464: o modo do servidor NÃO é uma troca da pessoa — acerta só o modo de baixo. setActiveMode (a troca explícita)
    // desliga o papel parceiro; usado aqui, a cada carga do painel o cabeçalho passava a proprietário e voltava a
    // parceiro quando a leitura do perfil chegava.
    if (modo) useAuthStore.setState({ activeMode: modo });
    if (regravar && modo) salvarModo(modo).catch(() => {});
    else if (servidor) limparPendente(window.localStorage, servidor);
  }, [initialMode]);

  // E653: o servidor atrasou ou falhou (a casca só espera LIMITE_CASCA_MS): sem isto o papel salvo era abandonado em
  // silêncio e o painel ficava com o padrão do navegador (o Início do dono perdia as seções e não voltava). Relê o modo
  // com esperas crescentes e só aplica se a pessoa não trocou nem tem troca pendente no meio.
  useEffect(() => {
    if (!precisaReler(initialMode === "owner" || initialMode === "tenant" ? initialMode : null, indisponivel)) return;
    let vivo = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const modoEmUso = () => {
      const m = useAuthStore.getState().activeMode;
      return m === "owner" || m === "tenant" ? m : null;
    };
    const antes = modoEmUso();
    const tentar = (i: number) => {
      if (!vivo || i >= ESPERAS_RELEITURA_MS.length) return;
      timer = setTimeout(() => {
        resolveInitialMode()
          .then((lido) => {
            if (!vivo) return;
            const aplicar = aplicarReleitura(lido, antes, modoEmUso(), lerPendente(window.localStorage));
            // Resposta válida (mesmo "conta nova") encerra a releitura; só o ERRO tenta de novo.
            if (aplicar) useAuthStore.setState({ activeMode: aplicar });
          })
          .catch(() => tentar(i + 1));
      }, ESPERAS_RELEITURA_MS[i]);
    };
    tentar(0);
    return () => {
      vivo = false;
      if (timer) clearTimeout(timer);
    };
  }, [initialMode, indisponivel]);
  return null;
}
