/*
  E565 (decisão do Daniel, 04/11/2026) — o que CONTA para a faixa da tabela de taxa (12/10/8/6%). PURO.
  Só imóveis ATIVOS DE VERDADE: publicado (status "active"), documento APROVADO (o vigente — E-DOC-VIGENTE) e calendário
  confirmado nos últimos 30 dias (o mesmo corte do ranking). Rascunho, pausado, sem documento ou com calendário parado
  não infla a carteira para derrubar a taxa. O congelamento (menor faixa entre envio e aceite) não muda.
  O banco conta igual (0292: public.imoveis_ativos_de_verdade, no gatilho da faixa_dono).
*/
import type { StatusDocumento } from "../documento/vigente.ts";

/** Calendário "atualizado": confirmado nos últimos 30 dias. */
export const DIAS_CALENDARIO_EM_DIA = 30;

const DIA_MS = 86_400_000;

export interface ImovelParaFaixa {
  status: string | null;
  /** Estado do documento VIGENTE (statusPorImovel). */
  documento: StatusDocumento | string | null | undefined;
  /** properties.disponibilidade_confirmada_em (ISO). */
  calendarioConfirmadoEm: string | null | undefined;
}

/** O imóvel conta para a faixa? Publicado + documento aprovado + calendário confirmado nos últimos 30 dias. */
export function contaParaFaixa(im: ImovelParaFaixa, agora: Date = new Date()): boolean {
  if (im.status !== "active") return false;
  if (im.documento !== "approved") return false;
  const t = im.calendarioConfirmadoEm ? Date.parse(im.calendarioConfirmadoEm) : NaN;
  if (!Number.isFinite(t)) return false;
  return agora.getTime() - t <= DIAS_CALENDARIO_EM_DIA * DIA_MS;
}

/** Quantos imóveis da carteira contam para a faixa. */
export function ativosDeVerdade(imoveis: readonly ImovelParaFaixa[], agora: Date = new Date()): number {
  return imoveis.filter((im) => contaParaFaixa(im, agora)).length;
}
