"use client";

import { createContext, useContext } from "react";
import type { ContadoresPainel } from "@/lib/painel/contadores";

/**
 * PROP-0: o contexto do menu (temImovel, imóveis ativos, parceiro, estadia, números) resolvido NO SERVIDOR pelo layout
 * do painel e entregue à casca já na 1ª pintura — o menu do dono não pisca de "conta nova" para "dono".
 * null = o servidor não resolveu (sem sessão ou falha): a casca segue com a leitura pela rota, como antes.
 */
const ContadoresIniciaisContexto = createContext<ContadoresPainel | null>(null);

export function ContadoresIniciais({ valor, children }: { valor: ContadoresPainel | null; children: React.ReactNode }) {
  return <ContadoresIniciaisContexto.Provider value={valor}>{children}</ContadoresIniciaisContexto.Provider>;
}

/** Valor inicial do menu vindo do servidor (ou null). Uso na casca: `useState(useContadoresIniciais() ?? CONTADORES_VAZIOS)`. */
export function useContadoresIniciais(): ContadoresPainel | null {
  return useContext(ContadoresIniciaisContexto);
}
