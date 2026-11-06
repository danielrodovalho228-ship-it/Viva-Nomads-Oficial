/*
  E614: campos do assistente que já nascem preenchidos — o preço sugerido da região, a garantia (caução à vista
  marcada) e o período mínimo (30 dias) — só contam no "N% pronto" depois de o dono CONFIRMAR: mexendo no campo ou
  tocando "Continuar" no passo deles. O portão de publicar não muda (eles seguem valendo para publicar). A lista vai
  no draft_data (`confirmados`); rascunho sem a chave (anterior a esta regra) conta como antes. PURO.
*/
import { ETAPA } from "./etapas-ids.ts";

export const CONFIRMAVEIS = ["preco", "garantia", "periodo"] as const;
export type CampoConfirmavel = (typeof CONFIRMAVEIS)[number];

/** O que o "Continuar" de cada passo confirma. */
export function confirmadosAoContinuar(etapa: number): CampoConfirmavel[] {
  if (etapa === ETAPA.preco) return ["preco", "garantia"];
  if (etapa === ETAPA.disponibilidade) return ["periodo"];
  return [];
}

/** Lê a lista do draft_data; ausente = null (rascunho antigo: a regra não se aplica). */
export function lerConfirmados(v: unknown): CampoConfirmavel[] | null {
  if (!Array.isArray(v)) return null;
  return CONFIRMAVEIS.filter((k) => v.includes(k));
}

/** Os confirmáveis que o dono ainda não confirmou. */
export function naoConfirmados(confirmados: readonly string[]): CampoConfirmavel[] {
  return CONFIRMAVEIS.filter((k) => !confirmados.includes(k));
}
