/*
  REGRA ÚNICA DE COBRANÇA (decisão final do Daniel, 10/10 — ordens eaa5adce e 3914d70c).
  12% sobre o PRIMEIRO aluguel de cada contrato novo e de cada renovação/extensão, igual para todos:
  sem faixas por volume, sem desconto, sem planos, sem mensalidade. O inquilino não paga taxa da Viva.
  Lógica PURA, sem banco. Os percentuais vêm da tabela de config (taxa_comissao / taxa_renovacao,
  em %); na falta dela vale o padrão abaixo, que espelha a migração 0099.
  A plataforma não toca no aluguel nem na caução: a taxa é cobrada à parte, do PROPRIETÁRIO.
*/

export const TAXA_COMISSAO_PADRAO = 0.12; // config taxa_comissao=12
export const TAXA_RENOVACAO_PADRAO = 0.12; // config taxa_renovacao=12

export type TipoCobranca = "novo" | "renovacao";

export interface TaxasConfig {
  taxaComissao?: number; // 0..1
  taxaRenovacao?: number; // 0..1
}

/** Config guarda inteiros em % ("12"); devolve fração 0..1 ou o padrão se o valor for inválido. */
export function taxaDeConfig(valor: string | number | null | undefined, padrao: number): number {
  if (valor === null || valor === undefined || valor === "") return padrao;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : padrao;
}

/** Valor em reais com centavos (4.320 × 12% = 518,40). Entrada inválida = 0. */
export function valorTaxa(aluguelMensal: number, taxa: number): number {
  if (!Number.isFinite(aluguelMensal) || aluguelMensal <= 0) return 0;
  if (!Number.isFinite(taxa) || taxa <= 0) return 0;
  return Math.round(aluguelMensal * 100 * taxa) / 100;
}

export interface TaxaFixadaAdmin {
  taxa: number;
  motivo: string;
  validoAte: Date;
}

/** Fixação do admin só vale com motivo (3+ caracteres, como no banco), taxa 0..1 e validade não vencida na assinatura. */
export function fixacaoAdminValida(f: TaxaFixadaAdmin | null | undefined, em: Date): f is TaxaFixadaAdmin {
  return (
    !!f &&
    f.motivo.trim().length >= 3 &&
    Number.isFinite(f.taxa) &&
    f.taxa >= 0 &&
    f.taxa <= 1 &&
    f.validoAte.getTime() >= em.getTime()
  );
}

export interface TaxaAplicada {
  taxa: number;
  origem: "regra_unica" | "admin";
  tipo: TipoCobranca;
}

/**
 * Taxa congelada na assinatura do contrato (tipo "novo") ou do aditivo (tipo "renovacao").
 * Não depende de quantos imóveis o dono tem: 1 ou 100, a taxa é a mesma. Só o admin pode
 * fixar outra taxa, e só com motivo e validade.
 */
export function taxaNaAssinatura(e: {
  tipo: TipoCobranca;
  assinadoEm: Date;
  config?: TaxasConfig;
  fixadaPeloAdmin?: TaxaFixadaAdmin | null;
}): TaxaAplicada {
  if (fixacaoAdminValida(e.fixadaPeloAdmin, e.assinadoEm)) {
    return { taxa: e.fixadaPeloAdmin.taxa, origem: "admin", tipo: e.tipo };
  }
  const taxa =
    e.tipo === "renovacao"
      ? (e.config?.taxaRenovacao ?? TAXA_RENOVACAO_PADRAO)
      : (e.config?.taxaComissao ?? TAXA_COMISSAO_PADRAO);
  return { taxa, origem: "regra_unica", tipo: e.tipo };
}

/** Valor exato a mostrar no painel do dono ANTES de aceitar o contrato/renovação. */
export function cobrancaParaAceite(e: {
  tipo: TipoCobranca;
  aluguelMensal: number;
  assinadoEm: Date;
  config?: TaxasConfig;
  fixadaPeloAdmin?: TaxaFixadaAdmin | null;
}): TaxaAplicada & { valor: number } {
  const t = taxaNaAssinatura(e);
  return { ...t, valor: valorTaxa(e.aluguelMensal, t.taxa) };
}

/** "12%" / "7,5%" */
export function pctTexto(taxa: number): string {
  return `${`${Math.round(taxa * 1000) / 10}`.replace(".", ",")}%`;
}

/** Texto oficial, igual em todos os lugares (ordem 3914d70c, item 2). */
export const TEXTO_REGRA_UNICA =
  "Anunciar é grátis. Você só paga quando alugar: 12% do primeiro aluguel de cada contrato e de cada renovação. Mesma regra para quem tem 1 ou 100 imóveis. Sem mensalidade. O inquilino não paga taxa da plataforma.";

export const TEXTO_REGRA_CURTO =
  "Anunciar é grátis. Você só paga quando alugar: 12% do primeiro aluguel de cada contrato e de cada renovação. Mesma regra para todos.";
