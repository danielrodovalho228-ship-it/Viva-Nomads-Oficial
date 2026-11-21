/*
  E948 — o prazo da análise do documento do imóvel (decisão do Daniel, 15/11). PURO.
  Público: até PRAZO_CANAL.documento.diasUteis (2) dias úteis a partir do envio, no calendário único (lib/calendario, que
  pula fim de semana e feriado nacional). Interno: a equipe é avisada quando o documento passa de
  ALERTA_DOCUMENTO_DIAS_UTEIS (1) dia útil na fila sem decisão. Publicação não tem prazo próprio.
*/
import { ALERTA_DOCUMENTO_DIAS_UTEIS, PRAZO_CANAL } from "../../config/prazos-canais.ts";
import { BRT, somarDiasUteis } from "../calendario/dias-uteis.ts";

const comoData = (v: Date | string) => (typeof v === "string" ? new Date(v) : v);

/** Até quando a Viva responde sobre o documento enviado em `enviadoEm`. */
export function prazoRespostaDocumento(enviadoEm: Date | string): Date {
  return somarDiasUteis(comoData(enviadoEm), PRAZO_CANAL.documento.diasUteis);
}

/** Atrasado (alerta interno): sem decisão e já passou de 1 dia útil desde o envio. */
export function documentoAtrasado(enviadoEm: Date | string, decididoEm: Date | string | null | undefined, agora: Date): boolean {
  if (decididoEm) return false;
  return agora.getTime() >= somarDiasUteis(comoData(enviadoEm), ALERTA_DOCUMENTO_DIAS_UTEIS).getTime();
}

/** "17/11/2026": a data do prazo em Brasília (um prazo, uma data, sem contagem regressiva). */
export function dataBRT(d: Date): string {
  const l = new Date(d.getTime() + BRT);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${dois(l.getUTCDate())}/${dois(l.getUTCMonth() + 1)}/${l.getUTCFullYear()}`;
}

/** O complemento de Meus imóveis: "resposta até 17/11/2026". */
export function textoRespostaAte(enviadoEm: Date | string): string {
  return `resposta até ${dataBRT(prazoRespostaDocumento(enviadoEm))}`;
}
