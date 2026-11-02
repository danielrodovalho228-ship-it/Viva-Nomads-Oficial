/*
  E328 (regra) — confirmar o horário É o aceite prático da visita. As telas já prometem o nome "depois do aceite"; o
  dono, porém, via "Quem vem: Interessado(a)" mesmo DEPOIS de confirmar. Agora, a partir da confirmação (status
  "confirmado" ou "feito"), cada lado vê o nome do outro NA VISITA (E427: completo): o dono vê quem vem, o morador vê quem recebe.
  Antes da confirmação segue protegido (só a candidatura aceita ou o contrato liberam, como antes). PURO.
  Roda: node --test src/lib/visitas/nome-visita.test.ts
*/

import { nomeCompleto } from "../perfil/perfil-publico.ts";

/** O 1º nome da outra parte aparece nesta visita? */
export function nomeLiberadoNaVisita(status: string | null | undefined, aceiteFora = false): boolean {
  return aceiteFora || status === "confirmado" || status === "feito";
}

/**
 * E427 (01/11, vigia): o nome que a outra parte vê NA VISITA depois do aceite é o nome COMPLETO, o mesmo de Mensagens,
 * da proposta, da estadia e da página pública vista por quem tem o aceite (fonte única: nomeCompleto). Antes era
 * "Ana C." (E409). Sem nome (ou um e-mail no lugar do nome), null — a tela mostra "Interessado(a)". A foto segue a
 * regra do avatar (relação aceita).
 */
export function nomeDepoisDoAceite(nome: string | null | undefined): string | null {
  return nomeCompleto(nome);
}
