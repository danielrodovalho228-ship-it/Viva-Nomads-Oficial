"use client";

import { useEffect } from "react";
import { useAuthStore, type ViewMode } from "@/lib/store";
import { decidirModoInicial, lerPendente, limparPendente } from "@/lib/modo-pendente";
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
export function ModeInitializer({ initialMode }: { initialMode: ViewMode | null }) {
  const setActiveMode = useAuthStore((s) => s.setActiveMode);
  useEffect(() => {
    const servidor = initialMode === "owner" || initialMode === "tenant" ? initialMode : null;
    const { modo, regravar } = decidirModoInicial(servidor, lerPendente(window.localStorage));
    if (modo) setActiveMode(modo);
    if (regravar && modo) salvarModo(modo).catch(() => {});
    else if (servidor) limparPendente(window.localStorage, servidor);
  }, [initialMode, setActiveMode]);
  return null;
}
