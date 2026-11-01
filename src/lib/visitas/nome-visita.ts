/*
  E328 (regra) — confirmar o horário É o aceite prático da visita. As telas já prometem o nome "depois do aceite"; o
  dono, porém, via "Quem vem: Interessado(a)" mesmo DEPOIS de confirmar. Agora, a partir da confirmação (status
  "confirmado" ou "feito"), cada lado vê o 1º nome do outro NA VISITA: o dono vê quem vem, o morador vê quem recebe.
  Antes da confirmação segue protegido (só a candidatura aceita ou o contrato liberam, como antes). PURO.
  Roda: node --test src/lib/visitas/nome-visita.test.ts
*/

import { nomeCurto } from "../perfil/perfil-publico.ts";

/** O 1º nome da outra parte aparece nesta visita? */
export function nomeLiberadoNaVisita(status: string | null | undefined, aceiteFora = false): boolean {
  return aceiteFora || status === "confirmado" || status === "feito";
}

/**
 * E409: o nome que a outra parte vê depois do aceite, como o desenho promete na Conta ("o seu primeiro nome, a inicial
 * do sobrenome e a foto"): "Ana C.". Antes, só "Ana". Nome de uma palavra fica como está; sem nome (ou um e-mail no
 * lugar do nome), null — a tela mostra "Interessado(a)". A foto segue a regra do avatar (relação aceita).
 */
export function nomeComInicial(nomeCompleto: string | null | undefined): string | null {
  // E427 (01/11): a MESMA regra da página pública (nomeCurto) — antes cada tela abreviava de um jeito.
  return nomeCurto(String(nomeCompleto ?? "").replace(/\s+/g, " "));
}
