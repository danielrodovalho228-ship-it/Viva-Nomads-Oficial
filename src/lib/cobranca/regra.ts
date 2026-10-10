/*
  COBRANÇA POR FAIXAS DE IMÓVEIS ATIVOS (decisão definitiva do Daniel, 10/10 — ordens aa916ba9 e f768b951,
  que valem sobre eaa5adce, 12eea681 e 5faa3903).
  A taxa vale POR CONTRATO FECHADO; a RENOVAÇÃO conta como novo contrato, com a mesma taxa da faixa do dono.
  Base: valor do primeiro mês do contrato/renovação. Sem mensalidade. O inquilino não paga taxa da Viva.
    1–2 imóveis = 12% · 3–5 = 10% · 6–15 = 8% · 16–30 = 6% · 31+ = "Plano Gestor — fale com a gente":
  continua em 6% até o admin fixar uma condição negociada (override com motivo e validade).
  Lógica PURA, sem banco. As faixas vêm da tabela de config (faixas_comissao); na falta dela vale o padrão
  abaixo, que espelha a migração 0100. A plataforma não toca no aluguel nem na caução: a taxa é cobrada
  à parte, do PROPRIETÁRIO.
*/

export type TipoCobranca = "novo" | "renovacao";

export interface FaixaComissao {
  minImoveis: number;
  maxImoveis: number | null; // null = sem teto
  taxa: number; // 0..1, sobre o valor do primeiro mês
  /** Faixa "Plano Gestor": taxa automática é a da faixa; condição melhor só por fixação do admin. */
  gestor?: boolean;
}

export const FAIXAS_COMISSAO_PADRAO: readonly FaixaComissao[] = [
  { minImoveis: 1, maxImoveis: 2, taxa: 0.12 },
  { minImoveis: 3, maxImoveis: 5, taxa: 0.1 },
  { minImoveis: 6, maxImoveis: 15, taxa: 0.08 },
  { minImoveis: 16, maxImoveis: 30, taxa: 0.06 },
  { minImoveis: 31, maxImoveis: null, taxa: 0.06, gestor: true },
];

export const TAXA_COMISSAO_PADRAO = FAIXAS_COMISSAO_PADRAO[0].taxa; // 1–2 imóveis
export const DIAS_PARA_NOVA_TAXA_APOS_QUEDA = 30;
const DIA_MS = 86_400_000;

/** Config guarda inteiros em % ("12"); devolve fração 0..1 ou o padrão se o valor for inválido. */
export function taxaDeConfig(valor: string | number | null | undefined, padrao: number): number {
  if (valor === null || valor === undefined || valor === "") return padrao;
  const n = Number(valor);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n / 100 : padrao;
}

function indiceFaixa(faixas: readonly FaixaComissao[], n: number): number {
  const q = Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1;
  const i = faixas.findIndex((f) => q >= f.minImoveis && (f.maxImoveis === null || q <= f.maxImoveis));
  return i === -1 ? faixas.length - 1 : i;
}

/** Faixa pela quantidade de imóveis ATIVOS (publicado e aprovado; rascunho não conta). */
export function faixaPorImoveisAtivos(n: number, faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): FaixaComissao {
  return faixas[indiceFaixa(faixas, n)];
}

/** Próxima faixa e quantos imóveis faltam ("Ative mais 1 imóvel e sua taxa cai para 10%"). Na faixa Gestor não há próxima. */
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

/** 31+ imóveis: o painel e a página de preços mostram "Falar sobre o Plano Gestor" em vez de taxa menor. */
export function ehPlanoGestor(n: number, faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): boolean {
  return faixaPorImoveisAtivos(n, faixas).gestor === true;
}

/**
 * Taxa média ponderada pelas faixas: `mix[i]` = parte dos contratos fechados por donos da faixa i
 * (não precisa somar 1; é normalizada). Base das projeções financeiras (/roi e /simulacao).
 * Mix vazio ou inválido = taxa da primeira faixa (1–2 imóveis).
 */
export function taxaMediaPonderada(mix: readonly number[], faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): number {
  let soma = 0;
  let peso = 0;
  faixas.forEach((f, i) => {
    const w = mix[i];
    if (Number.isFinite(w) && w > 0) {
      soma += f.taxa * w;
      peso += w;
    }
  });
  return peso > 0 ? soma / peso : faixas[0].taxa;
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
  origem: "admin" | "faixa" | "faixa_com_queda_recente";
  tipo: TipoCobranca;
  faixaNoFechamento: FaixaComissao;
}

/**
 * Taxa congelada na assinatura do contrato (tipo "novo") ou do aditivo (tipo "renovacao", que conta como
 * novo contrato: mesma taxa da faixa). Sobe de faixa na hora; ao cair de faixa, a taxa anterior vale por mais
 * 30 dias. Só o admin pode fixar outra taxa, e só com motivo e validade.
 */
export function taxaNaAssinatura(e: {
  tipo: TipoCobranca;
  imoveisAtivos: number;
  assinadoEm: Date;
  faixas?: readonly FaixaComissao[];
  queda?: { taxaAnterior: number; em: Date } | null;
  fixadaPeloAdmin?: TaxaFixadaAdmin | null;
}): TaxaAplicada {
  const faixa = faixaPorImoveisAtivos(e.imoveisAtivos, e.faixas ?? FAIXAS_COMISSAO_PADRAO);
  if (fixacaoAdminValida(e.fixadaPeloAdmin, e.assinadoEm)) {
    return { taxa: e.fixadaPeloAdmin.taxa, origem: "admin", tipo: e.tipo, faixaNoFechamento: faixa };
  }
  const q = e.queda;
  if (q && q.taxaAnterior < faixa.taxa && e.assinadoEm.getTime() < q.em.getTime() + DIAS_PARA_NOVA_TAXA_APOS_QUEDA * DIA_MS) {
    return { taxa: q.taxaAnterior, origem: "faixa_com_queda_recente", tipo: e.tipo, faixaNoFechamento: faixa };
  }
  return { taxa: faixa.taxa, origem: "faixa", tipo: e.tipo, faixaNoFechamento: faixa };
}

/** Valor exato a mostrar no painel do dono ANTES de aceitar o contrato/renovação. */
export function cobrancaParaAceite(e: Parameters<typeof taxaNaAssinatura>[0] & { aluguelMensal: number }): TaxaAplicada & { valor: number } {
  const t = taxaNaAssinatura(e);
  return { ...t, valor: valorTaxa(e.aluguelMensal, t.taxa) };
}

/** "12%" / "7,5%" */
export function pctTexto(taxa: number): string {
  return `${`${Math.round(taxa * 1000) / 10}`.replace(".", ",")}%`;
}

/** Linha do painel do proprietário, ANTES de aceitar contrato/renovação (ordens 12eea681 e 5faa3903). */
export function textoTaxaPainel(taxa: number, valorMensal: number): string {
  const base = `Taxa de serviço: ${pctTexto(taxa)} do primeiro mês`;
  const valor = valorTaxa(valorMensal, taxa);
  if (valor <= 0) return base;
  return `${base} = R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Mensagem pública ÚNICA e curta (ordens 12eea681 e 5faa3903, Daniel 10/10). Nas páginas públicas
 * não aparece "aluguel", "comissão" etc. sobre a cobrança; o detalhe ("12% do valor do primeiro
 * mês") fica só no painel do proprietário, antes de aceitar, e nos termos.
 */
export const TEXTO_REGRA_UNICA =
  "Anunciar é grátis. A Viva cobra 12% por contrato fechado. Quanto mais imóveis, menor a taxa (até 4%). Sem mensalidade.";

export const TEXTO_REGRA_CURTO = TEXTO_REGRA_UNICA;
