/*
  Cobrança "Pague quando alugar" (ordens 07fb7229, 31e8d72c e 9106387a do Daniel, 09/10).
  Lógica PURA e sem acesso a banco: as faixas vêm de fora (tabela de config) e, na
  falta delas, vale o seed abaixo, que espelha o seed da migração 0096.
  A plataforma não toca no aluguel nem na caução: a comissão é cobrada à parte, do PROPRIETÁRIO.
*/

export interface FaixaComissao {
  minImoveis: number;
  maxImoveis: number | null; // null = sem teto
  taxa: number; // 0..1, sobre o PRIMEIRO aluguel de cada contrato novo
}

export const FAIXAS_COMISSAO_PADRAO: readonly FaixaComissao[] = [
  { minImoveis: 1, maxImoveis: 2, taxa: 0.12 },
  { minImoveis: 3, maxImoveis: 5, taxa: 0.1 },
  { minImoveis: 6, maxImoveis: 15, taxa: 0.08 },
  { minImoveis: 16, maxImoveis: 30, taxa: 0.06 },
  { minImoveis: 31, maxImoveis: null, taxa: 0.04 },
];

export interface FaixaAssinatura {
  minImoveis: number;
  maxImoveis: number | null;
  mensal: number; // R$/mês
}

// Fase 2 (flag assinatura_ativa=false). Valores também vão para a tabela de config.
export const FAIXAS_ASSINATURA_PADRAO: readonly FaixaAssinatura[] = [
  { minImoveis: 1, maxImoveis: 2, mensal: 149 },
  { minImoveis: 3, maxImoveis: 5, mensal: 299 },
  { minImoveis: 6, maxImoveis: 10, mensal: 499 },
  { minImoveis: 11, maxImoveis: 20, mensal: 799 },
  { minImoveis: 21, maxImoveis: null, mensal: 999 },
];

export const CARENCIA_ASSINATURA_DIAS_PADRAO = 90;
export const DIAS_PARA_NOVA_TAXA_APOS_QUEDA = 30;
export const CONTRATOS_POR_ANO_COMPARADOR = 3.5;

const DIA_MS = 86_400_000;

function indiceFaixa(faixas: readonly { minImoveis: number; maxImoveis: number | null }[], n: number): number {
  const q = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
  const i = faixas.findIndex((f) => q >= f.minImoveis && (f.maxImoveis === null || q <= f.maxImoveis));
  return i === -1 ? faixas.length - 1 : i;
}

/** Taxa pela quantidade de imóveis ATIVOS (publicado e aprovado; rascunho não conta). */
export function faixaPorImoveisAtivos(n: number, faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): FaixaComissao {
  return faixas[indiceFaixa(faixas, n)];
}

/** Próxima faixa e quantos imóveis faltam ("Ative mais 1 imóvel e sua taxa cai para 10%"). */
export function proximaFaixa(
  n: number,
  faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO,
): { faltam: number; taxa: number } | null {
  const i = indiceFaixa(faixas, n);
  const prox = faixas[i + 1];
  if (!prox) return null;
  const atuais = Math.max(1, Math.floor(Number.isFinite(n) ? n : 1));
  return { faltam: prox.minImoveis - atuais, taxa: prox.taxa };
}

/** Comissão em reais com centavos (4.320 × 12% = 518,40). */
export function comissaoPrimeiroAluguel(aluguelMensal: number, taxa: number): number {
  if (!Number.isFinite(aluguelMensal) || aluguelMensal <= 0) return 0;
  if (!Number.isFinite(taxa) || taxa <= 0) return 0;
  return Math.round(aluguelMensal * 100 * taxa) / 100;
}

/** Extensão/renovação do mesmo inquilino no mesmo imóvel (Daniel, 09/10): 6%, valor também em config_cobranca.taxa_extensao. */
export const TAXA_EXTENSAO_PADRAO = 0.06;

export type TipoCobranca = "novo" | "extensao";

/**
 * config_cobranca.taxa_extensao guarda o PERCENTUAL ('6'); o código trabalha com fração (0.06).
 * Converte /100 e cai no padrão se o valor faltar, for inválido ou fora de 0–100.
 */
export function taxaExtensaoDeConfig(valor: string | number | null | undefined): number {
  const n = typeof valor === "number" ? valor : typeof valor === "string" && valor.trim() !== "" ? Number(valor.replace(",", ".")) : Number.NaN;
  if (!Number.isFinite(n) || n < 0 || n > 100) return TAXA_EXTENSAO_PADRAO;
  return n / 100;
}

/** Taxa da extensão: 6% sobre o primeiro aluguel do período estendido, nunca acima da taxa da faixa do dono. */
export function taxaExtensao(taxaFaixaDono: number, taxaExtensaoConfig: number = TAXA_EXTENSAO_PADRAO): number {
  if (!Number.isFinite(taxaFaixaDono) || taxaFaixaDono < 0) return taxaExtensaoConfig;
  if (!Number.isFinite(taxaExtensaoConfig) || taxaExtensaoConfig < 0) return taxaFaixaDono;
  return Math.min(taxaFaixaDono, taxaExtensaoConfig);
}

/** Comissão da extensão sobre o primeiro aluguel do período estendido (4.320 × 6% = 259,20; dono a 4% paga 172,80). */
export function comissaoExtensao(aluguelPrimeiroMesDaExtensao: number, taxaFaixaDono: number, taxaExtensaoConfig?: number): number {
  return comissaoPrimeiroAluguel(aluguelPrimeiroMesDaExtensao, taxaExtensao(taxaFaixaDono, taxaExtensaoConfig));
}

export interface TaxaFixadaAdmin {
  taxa: number;
  motivo: string;
  validoAte: Date;
}

export interface EntradaTaxa {
  imoveisAtivos: number;
  assinadoEm: Date;
  faixas?: readonly FaixaComissao[];
  /** Quando o dono caiu de faixa: a taxa anterior (melhor) e a data da queda. */
  queda?: { taxaAnterior: number; em: Date } | null;
  /** Taxa negociada fora do sistema; precisa de motivo e validade. */
  fixadaPeloAdmin?: TaxaFixadaAdmin | null;
}

export interface TaxaAplicada {
  taxa: number;
  origem: "admin" | "faixa" | "faixa_com_queda_recente";
  faixaNoFechamento: FaixaComissao;
}

/** Fixação do admin só vale com motivo de 3+ caracteres (como o check do banco), taxa entre 0 e 1 e validade ainda não vencida na assinatura. */
export function fixacaoAdminValida(f: TaxaFixadaAdmin | null | undefined, em: Date): f is TaxaFixadaAdmin {
  return !!f && f.motivo.trim().length >= 3 && Number.isFinite(f.taxa) && f.taxa >= 0 && f.taxa <= 1 && f.validoAte.getTime() >= em.getTime();
}

/**
 * Taxa congelada na assinatura. Sobe de faixa na hora; ao cair de faixa, a taxa
 * anterior vale por mais 30 dias (a nova só para contratos assinados depois disso).
 */
export function taxaNaAssinatura(e: EntradaTaxa): TaxaAplicada {
  const faixas = e.faixas ?? FAIXAS_COMISSAO_PADRAO;
  const faixa = faixaPorImoveisAtivos(e.imoveisAtivos, faixas);
  if (fixacaoAdminValida(e.fixadaPeloAdmin, e.assinadoEm)) {
    return { taxa: e.fixadaPeloAdmin.taxa, origem: "admin", faixaNoFechamento: faixa };
  }
  const q = e.queda;
  if (q && q.taxaAnterior < faixa.taxa && e.assinadoEm.getTime() < q.em.getTime() + DIAS_PARA_NOVA_TAXA_APOS_QUEDA * DIA_MS) {
    return { taxa: q.taxaAnterior, origem: "faixa_com_queda_recente", faixaNoFechamento: faixa };
  }
  return { taxa: faixa.taxa, origem: "faixa", faixaNoFechamento: faixa };
}

// ── Fase 2: assinatura sem comissão (flag assinatura_ativa=false) ──

export function mensalidadePorImoveis(n: number, faixas: readonly FaixaAssinatura[] = FAIXAS_ASSINATURA_PADRAO): number {
  return faixas[indiceFaixa(faixas, n)].mensal;
}

/** Comissão 0% só se a flag está ligada e a assinatura tem >= carência dias na data do contrato. */
export function assinaturaIsentaComissao(a: {
  flagAtiva: boolean;
  assinaturaDesde: Date | null;
  assinadoEm: Date;
  carenciaDias?: number;
}): boolean {
  if (!a.flagAtiva || !a.assinaturaDesde) return false;
  const carencia = a.carenciaDias ?? CARENCIA_ASSINATURA_DIAS_PADRAO;
  return a.assinadoEm.getTime() >= a.assinaturaDesde.getTime() + carencia * DIA_MS;
}

/** Comparador simples: quanto o dono paga por ano em cada opção. */
export function compararOpcoes(imoveis: number, aluguelMedio: number): { comissaoAno: number; assinaturaAno: number } {
  const taxa = faixaPorImoveisAtivos(imoveis).taxa;
  const comissaoAno = Math.round(CONTRATOS_POR_ANO_COMPARADOR * comissaoPrimeiroAluguel(aluguelMedio, taxa) * 100) / 100;
  return { comissaoAno, assinaturaAno: mensalidadePorImoveis(imoveis) * 12 };
}
