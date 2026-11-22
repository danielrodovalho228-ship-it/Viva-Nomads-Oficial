/**
 * E1077 (ORDEM-DUET-369): o âmbito da chave da avaliação do imóvel. Regras puras, sem servidor.
 *  - global: VISTORIA_ATIVA ligada (o lançamento público; as condições dele não mudam aqui);
 *  - laboratorio: o cookie do laboratório (INTEGRACOES_SIMULADAS), como antes;
 *  - piloto: a chave desligada, mas a conta da sessão está na lista do piloto (vistoria_piloto) — o teste com o
 *    Rogério e a esposa, depois da prova do Gerente;
 *  - desligada: todas as outras contas — nada aparece, como hoje.
 */
export type ModoDaChave = "global" | "laboratorio" | "piloto" | "desligada";

export function modoDaChave(e: { global: boolean; laboratorio: boolean; noPiloto: boolean }): ModoDaChave {
  if (e.global) return "global";
  if (e.laboratorio) return "laboratorio";
  if (e.noPiloto) return "piloto";
  return "desligada";
}

export function chaveAberta(modo: ModoDaChave): boolean {
  return modo !== "desligada";
}

/** No modo piloto, o rodízio só oferece avaliadores do piloto; nos outros modos a fila fica como está. */
export function filaNoAmbito<T extends { userId: string }>(fila: T[], modo: ModoDaChave, piloto: Set<string>): T[] {
  return modo === "piloto" ? fila.filter((a) => piloto.has(a.userId)) : fila;
}
