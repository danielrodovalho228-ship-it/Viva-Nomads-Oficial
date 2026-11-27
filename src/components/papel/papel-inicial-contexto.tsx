"use client";

import { createContext, useContext } from "react";
import type { PapelInicialServidor } from "@/lib/papel/papel-inicial";

/**
 * E1026 — o papel ativo que o servidor leu ao montar o painel chega à casca por PROP + contexto (nunca pelo store global
 * no servidor: E793, risco H1). `null` = sem leitura (sem sessão, atraso, falha, ou fora do painel).
 */
const Contexto = createContext<PapelInicialServidor | null>(null);

export function usePapelInicialServidor(): PapelInicialServidor | null {
  return useContext(Contexto);
}

export function PapelInicialProvider({ valor, children }: { valor: PapelInicialServidor | null; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
