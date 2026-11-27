"use client";

import { createContext, useContext } from "react";

/**
 * E1136 — se a conta é de teste, lido pela página NO SERVIDOR, chega à Caixa de e-mails de teste por contexto (o mesmo
 * desenho do papel inicial, E1026). `true`/`false` = o servidor leu; `null` = não leu (sem sessão, atraso, falha);
 * `undefined` = a página não disse nada. Nos dois últimos vale a sessão do navegador.
 */
const Contexto = createContext<boolean | null | undefined>(undefined);

export function useContaDeTesteDoServidor(): boolean | null | undefined {
  return useContext(Contexto);
}

export function ContaDeTesteDoServidor({ valor, children }: { valor: boolean | null; children: React.ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}
