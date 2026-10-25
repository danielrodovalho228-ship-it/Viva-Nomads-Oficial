/**
 * Candidatura em etapas (ordem eb4b11d8, Pacote Clareza UX5): revisar → mensagem → confirmar.
 * Funções puras e client-safe. O servidor continua validando tudo (requestLead).
 */
import { guardContactInfo } from "./messages/contact-guard.ts";

export type EtapaCandidatura = "revisar" | "mensagem" | "confirmar";

export const ETAPAS_CANDIDATURA: { chave: EtapaCandidatura; rotulo: string }[] = [
  { chave: "revisar", rotulo: "Revisar" },
  { chave: "mensagem", rotulo: "Mensagem" },
  { chave: "confirmar", rotulo: "Confirmar" },
];

export const TERMOS_CANDIDATURA = "Ao enviar, concordo com os termos de uso da Viva Nomads.";

/** Mesmo teto de requestLead para a mensagem (note.slice(0, 1000)). */
export const LIMITE_APRESENTACAO = 1000;

const ORDEM = ETAPAS_CANDIDATURA.map((e) => e.chave);

export function proximaEtapa(e: EtapaCandidatura): EtapaCandidatura {
  return ORDEM[Math.min(ORDEM.indexOf(e) + 1, ORDEM.length - 1)];
}

export function etapaAnterior(e: EtapaCandidatura): EtapaCandidatura {
  return ORDEM[Math.max(ORDEM.indexOf(e) - 1, 0)];
}

/** Barra de progresso do topo: 33 / 67 / 100. */
export function progressoEtapa(e: EtapaCandidatura): number {
  return Math.round(((ORDEM.indexOf(e) + 1) / ORDEM.length) * 100);
}

export type ApresentacaoValida = { ok: true; texto: string; mascarou: boolean } | { ok: false; erro: string };

/** Apresentação ao proprietário (opcional): contato direto é mascarado, igual ao chat. */
export function validarApresentacao(entrada: string): ApresentacaoValida {
  const t = (entrada ?? "").trim();
  if (t.length > LIMITE_APRESENTACAO) {
    return { ok: false, erro: `A mensagem passou de ${LIMITE_APRESENTACAO} caracteres. Encurte para continuar.` };
  }
  if (!t) return { ok: true, texto: "", mascarou: false };
  const g = guardContactInfo(t);
  return { ok: true, texto: g.text, mascarou: g.masked };
}
