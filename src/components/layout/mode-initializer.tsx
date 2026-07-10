"use client";

import { useEffect } from "react";
import { useAuthStore, type ViewMode } from "@/lib/store";

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
 */
export function ModeInitializer({ initialMode }: { initialMode: ViewMode | null }) {
  const setActiveMode = useAuthStore((s) => s.setActiveMode);
  useEffect(() => {
    if (initialMode === "owner" || initialMode === "tenant") {
      setActiveMode(initialMode);
    }
  }, [initialMode, setActiveMode]);
  return null;
}
