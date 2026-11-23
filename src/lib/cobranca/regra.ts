/*
  COBRANÇA POR FAIXAS DE IMÓVEIS ATIVOS (decisão definitiva do Daniel, 10/10 — ordens aa916ba9 e f768b951,
  que valem sobre eaa5adce, 12eea681 e 5faa3903).
  A taxa vale sobre o VALOR TOTAL de cada contrato fechado (aluguel mensal × meses contratados — ordem do
  Daniel, 14/10). Cada renovação/prorrogação é cobrada à parte, sobre o valor total do período renovado, com a
  taxa da faixa do dono no momento do fechamento. Sem mensalidade. O inquilino não paga taxa da Viva.
    1–2 imóveis = 12% · 3–5 = 10% · 6–15 = 8% · 16–19 = 6%; a partir de 20, condição combinada com a Viva.
  ORDEM-DUET-534 (Gerente, 22/11/2026): a escada PUBLICADA termina em "16–19 = 6%", como nos Termos ("16 a 19, 6%; 20 ou
  mais, condição negociada"). A partir de CARTEIRAS_MINIMO_IMOVEIS (20) nenhum texto promete percentual: vale a linha
  de carteiras. O CÁLCULO não mudou: a última faixa da tabela continua sem teto (16+ = 6%) e é o que vale para quem
  tem 20 ou mais sem condição combinada (taxa fixada pelo admin).
  Prompt 078 (decisão do Daniel, 16/11/2026): o Plano Gestor de 4% deixou de ser oferta pública. A faixa de 20+ a 4% (E564)
  saiu, e a conta de administradora não escolhe mais uma faixa especial: vale a escada como para todos. Carteira a partir de
  20 imóveis ou administradora fala com a Viva (TEXTO_CARTEIRAS, config/planos.ts); condição especial é só a taxa fixada
  pelo admin, com motivo e validade (TaxaFixadaAdmin). A faixa "31+ negociável" já tinha deixado de existir (E564).
  Imóveis que contam: só os ATIVOS DE VERDADE (E565, carteira-ativa.ts).
  Lógica PURA, sem banco. As faixas vêm da tabela de config (faixas_comissao); na falta dela vale o padrão
  abaixo, que espelha a migração 0100. A plataforma não toca no aluguel nem na caução: a taxa é cobrada
  à parte, do PROPRIETÁRIO.
*/
import { REGRAS_CONTRATO } from "../../config/planos.ts";

/** E1116 (ORDEM-DUET-503): dias por mês da regra única (REGRAS_CONTRATO.diasPorMes), nunca um 30 à mão. */
const DIAS_POR_MES = REGRAS_CONTRATO.diasPorMes;

import { CARTEIRAS_MINIMO_IMOVEIS } from "../../config/planos.ts";

export type TipoCobranca = "novo" | "renovacao";

export interface FaixaComissao {
  minImoveis: number;
  maxImoveis: number | null; // null = sem teto
  taxa: number; // 0..1, sobre o valor total do contrato (aluguel × meses)
  /** Legado: a faixa "31+ negociável" saiu no E564 (nenhuma faixa padrão é negociável). Mantido só para leitura. */
  negociavel?: boolean;
}

export const FAIXAS_COMISSAO_PADRAO: readonly FaixaComissao[] = [
  { minImoveis: 1, maxImoveis: 2, taxa: 0.12 },
  { minImoveis: 3, maxImoveis: 5, taxa: 0.1 },
  { minImoveis: 6, maxImoveis: 15, taxa: 0.08 },
  { minImoveis: 16, maxImoveis: null, taxa: 0.06 },
];

export const TAXA_COMISSAO_PADRAO = FAIXAS_COMISSAO_PADRAO[0].taxa; // 1–2 imóveis
/**
 * Prompt 16: a "Análise da carteira" abre a partir da 2ª faixa (3 imóveis ativos), pela MESMA regra das taxas —
 * sem plano pago nem trava de upgrade.
 */
export const MIN_IMOVEIS_ANALISE_CARTEIRA = FAIXAS_COMISSAO_PADRAO[1].minImoveis;
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

/** Próxima faixa e quantos imóveis faltam ("Ative mais 1 imóvel e sua taxa cai para 10%"). Na última faixa não há próxima. */
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

/** Legado (E564): a faixa "31+ negociável" saiu — com as faixas padrão, sempre false. */
export function ehFaixaNegociavel(n: number, faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): boolean {
  return faixaPorImoveisAtivos(n, faixas).negociavel === true;
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

/**
 * ÚNICA fórmula da comissão (ordem do Daniel, 14/10): valor_total = aluguel mensal × meses contratados;
 * comissão = valor_total × taxa da faixa. Vale para o contrato e para cada renovação (período renovado).
 * Reais com centavos (3.000 × 3 × 12% = 1.080). Entrada inválida (aluguel, meses ou taxa) = 0.
 */
export function comissaoSobreContrato(aluguelMensal: number, meses: number, taxa: number): number {
  if (!Number.isFinite(aluguelMensal) || aluguelMensal <= 0) return 0;
  if (!Number.isFinite(meses) || meses < 1) return 0;
  if (!Number.isFinite(taxa) || taxa <= 0) return 0;
  return Math.round(aluguelMensal * Math.floor(meses) * 100 * taxa) / 100;
}

/**
 * E562: a MESMA fórmula para a estadia em dias — valor_total = aluguel mensal × dias ÷ 30; comissão = valor_total × taxa.
 * Em meses cheios (dias múltiplo de 30) dá o mesmo que comissaoSobreContrato. Entrada inválida = 0.
 */
export function comissaoSobreDias(aluguelMensal: number, dias: number, taxa: number): number {
  if (!Number.isFinite(aluguelMensal) || aluguelMensal <= 0) return 0;
  if (!Number.isFinite(dias) || dias < 1) return 0;
  if (!Number.isFinite(taxa) || taxa <= 0) return 0;
  return Math.round(((aluguelMensal * Math.round(dias)) / DIAS_POR_MES) * 100 * taxa) / 100;
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
  const faixas = e.faixas ?? FAIXAS_COMISSAO_PADRAO;
  // Prompt 078: o tipo da conta (administradora) não escolhe faixa; vale a escada pelos imóveis ativos, para todos.
  const faixa = faixaPorImoveisAtivos(e.imoveisAtivos, faixas);
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
export function cobrancaParaAceite(
  e: Parameters<typeof taxaNaAssinatura>[0] & { aluguelMensal: number; meses: number },
): TaxaAplicada & { valor: number } {
  const t = taxaNaAssinatura(e);
  return { ...t, valor: comissaoSobreContrato(e.aluguelMensal, e.meses, t.taxa) };
}

/** "12%" / "7,5%" */
export function pctTexto(taxa: number): string {
  return `${`${Math.round(taxa * 1000) / 10}`.replace(".", ",")}%`;
}

/** Texto público da taxa: a faixa sem teto é "Negociado" — nunca um percentual fixo (decisão do Daniel, 10/10). */
export const TAXA_NEGOCIADA_TEXTO = "Negociado";
export function taxaPublicaTexto(f: FaixaComissao): string {
  return f.negociavel ? TAXA_NEGOCIADA_TEXTO : pctTexto(f.taxa);
}

/** Legado (E252-B): o rótulo da antiga faixa "31+ negociável", que saiu no E564. */
export const ROTULO_FAIXA_NEGOCIAVEL = "taxa negociável";
/**
 * ORDEM-DUET-534: até onde a escada PUBLICADA vai. A última faixa da tabela não tem teto (é ela que calcula a taxa de
 * quem tem 20 ou mais sem condição combinada), mas nos textos ela é publicada como "16–19": a partir de
 * CARTEIRAS_MINIMO_IMOVEIS a condição é combinada com a Viva e nenhum percentual é prometido. Faixa sem teto que começa
 * no próprio limiar (ou depois) continua a ser dita como "N ou mais" / "N+" — não há teto público menor que o início.
 */
export function tetoPublicado(f: FaixaComissao): number | null {
  if (f.maxImoveis !== null) return f.maxImoveis;
  return f.minImoveis < CARTEIRAS_MINIMO_IMOVEIS ? CARTEIRAS_MINIMO_IMOVEIS - 1 : null;
}

/** Rótulo da faixa nas tabelas: "1–2", "16–19", "31+ · taxa negociável"; com `imoveis`, "1–2 imóveis", "31+ imóveis · taxa negociável". */
export function rotuloFaixaTaxa(f: FaixaComissao, imoveis = false): string {
  const teto = tetoPublicado(f);
  const base = teto === null ? `${f.minImoveis}+` : f.minImoveis === teto ? `${f.minImoveis}` : `${f.minImoveis}–${teto}`;
  const comImoveis = imoveis ? `${base} imóveis` : base;
  return f.negociavel ? `${comImoveis} · ${ROTULO_FAIXA_NEGOCIAVEL}` : comImoveis;
}

/** Prompt 078 / ORDEM-DUET-534: a faixa por extenso, para frases — "1–2", "16–19" (a última faixa publicada; ver tetoPublicado). */
export function faixaPorExtenso(f: FaixaComissao): string {
  const teto = tetoPublicado(f);
  if (teto === null) return `${f.minImoveis} ou mais`;
  return f.minImoveis === teto ? `${f.minImoveis}` : `${f.minImoveis}–${teto}`;
}

/**
 * ORDEM-DUET-534: a faixa como o CÁLCULO a lê — a última, sem teto, é "16 ou mais". Só para telas INTERNAS (o modelo dos
 * sócios), que projetam com a tabela de cálculo. Texto público usa faixaPorExtenso (a última publicada é "16–19").
 */
export function faixaDoCalculoPorExtenso(f: FaixaComissao): string {
  if (f.maxImoveis === null) return `${f.minImoveis} ou mais`;
  return f.minImoveis === f.maxImoveis ? `${f.minImoveis}` : `${f.minImoveis}–${f.maxImoveis}`;
}

/**
 * E805/078 — a ESCADA inteira, lida da regra:
 * "1–2 imóveis: 12% · 3–5 imóveis: 10% · 6–15 imóveis: 8% · 16–19 imóveis: 6%". Nenhum número escrito à mão.
 */
export function escadaTaxasTexto(faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): string {
  return faixas.map((f) => `${faixaPorExtenso(f)} imóveis: ${taxaPublicaTexto(f)}`).join(" · ");
}

/** Prompt 078 — a escada curta da Ajuda e do atendimento: "1–2 = 12%, 3–5 = 10%, 6–15 = 8%, 16–19 = 6%". */
export function escadaTaxasCurta(faixas: readonly FaixaComissao[] = FAIXAS_COMISSAO_PADRAO): string {
  return faixas.map((f) => `${faixaPorExtenso(f)} = ${taxaPublicaTexto(f)}`).join(", ");
}

/** Prompt 078: a maior e a menor taxa da escada, para as frases ("cobra 12%… (até 6%)") — nunca escritas à mão. */
export const TAXA_MAIOR_TEXTO = pctTexto(Math.max(...FAIXAS_COMISSAO_PADRAO.map((f) => f.taxa)));
export const TAXA_MENOR_TEXTO = pctTexto(Math.min(...FAIXAS_COMISSAO_PADRAO.map((f) => f.taxa)));

/** "R$ 3.200" (inteiro) / "R$ 259,20" (com centavos). */
export function brlTaxa(v: number): string {
  const inteiro = Math.abs(v - Math.round(v)) < 0.005;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: inteiro ? 0 : 2, maximumFractionDigits: inteiro ? 0 : 2 })}`;
}

/**
 * Rótulo ÚNICO da taxa de serviço (prompt 27, item 6), em todo lugar que mostra a taxa (proposta, orçamento,
 * Fechamento, contrato, simuladores): "Taxa de serviço: 12% sobre o valor mensal × meses (R$ 3.200 × 4 = R$ 12.800)
 * = R$ 1.536". A base é só o valor mensal × meses — nunca o "total do contrato", que inclui consumo, limpeza e pet.
 * `valorGravado`: a taxa já gravada (congelada no aceite), quando houver; senão, calculada pela regra.
 */
export function rotuloTaxaServico(taxa: number, valorMensal: number, meses: number, valorGravado?: number | null): string {
  const inicio = `Taxa de serviço: ${pctTexto(taxa)} sobre o valor mensal × meses`;
  const v = Number.isFinite(valorMensal) && valorMensal > 0 ? valorMensal : 0;
  const m = Number.isFinite(meses) && meses > 0 ? meses : 0;
  if (!(v > 0 && m > 0)) return inicio;
  if (!Number.isInteger(Math.round(m * 1e6) / 1e6)) {
    // E562 (telas): estadia em dias exatos — a conta aberta em dias: "R$ 2.800 × 43 dias ÷ 30 = R$ 4.013,33".
    const dias = Math.round(m * DIAS_POR_MES);
    const base = Math.round(((v * dias) / DIAS_POR_MES) * 100) / 100;
    const valorDias = valorGravado != null && Number.isFinite(valorGravado) ? valorGravado : comissaoSobreDias(v, dias, taxa);
    return `Taxa de serviço: ${pctTexto(taxa)} sobre o valor mensal × dias ÷ ${DIAS_POR_MES} (${brlTaxa(v)} × ${dias} dias ÷ ${DIAS_POR_MES} = ${brlTaxa(base)}) = ${brlTaxa(valorDias)}`;
  }
  // E562: estadia em dias exatos chega como meses fracionários (dias ÷ 30) — a fórmula em dias, sem truncar.
  const calculado = Number.isInteger(m) ? comissaoSobreContrato(v, m, taxa) : comissaoSobreDias(v, Math.round(m * DIAS_POR_MES), taxa);
  const valor = valorGravado != null && Number.isFinite(valorGravado) ? valorGravado : calculado;
  return `${inicio} (${brlTaxa(v)} × ${numMeses(m)} = ${brlTaxa(Math.round(v * m * 100) / 100)}) = ${brlTaxa(valor)}`;
}

const numMeses = (m: number) => `${Math.round(m * 10) / 10}`.replace(".", ",");

/** Linha do painel do proprietário, ANTES de aceitar contrato/renovação: o rótulo único (prompt 27). */
export function textoTaxaPainel(taxa: number, valorMensal: number, meses: number): string {
  return rotuloTaxaServico(taxa, valorMensal, meses);
}

/**
 * Mensagem pública ÚNICA e curta (ordem b3c9d76e do Daniel, 14/10): a comissão é sobre o valor TOTAL do
 * contrato fechado (aluguel × meses), em cada contrato e em cada renovação.
 */
export const TEXTO_REGRA_UNICA =
  `Anunciar é grátis. A Viva cobra ${TAXA_MAIOR_TEXTO} sobre o valor total do contrato fechado. Quanto mais imóveis, menor a taxa (até ${TAXA_MENOR_TEXTO}). Sem mensalidade.`;

export const TEXTO_REGRA_CURTO = TEXTO_REGRA_UNICA;

/** Meta description de /precos (≤155 caracteres; ordem 218c62ad, #153). */
export const DESCRICAO_PRECOS =
  `Anunciar é grátis. A Viva cobra ${TAXA_MAIOR_TEXTO} do contrato fechado, menor com mais imóveis (até ${TAXA_MENOR_TEXTO}). Sem mensalidade. Para imóveis mobiliados.`;

/** Frase padrão (ordem b3c9d76e), com a taxa da faixa. */
export function fraseComissaoUnica(taxaTexto: string): string {
  return `A VivaNomads cobra uma comissão única de ${taxaTexto} sobre o valor total do contrato de locação fechado pela plataforma.`;
}

/** Para cartões: "12% sobre o valor total do contrato fechado." */
export function comissaoCurta(taxaTexto: string): string {
  return `${taxaTexto} sobre o valor total do contrato fechado.`;
}

/** Renovação/prorrogação (decisão do Daniel, 14/10): cobrada à parte, sobre o valor total do período renovado. */
export const TEXTO_RENOVACAO_COMISSAO =
  "A taxa é cobrada uma vez em cada contrato e em cada renovação, sobre o valor total do período contratado.";

/**
 * E1111 (ORDEM-DUET-494): o exemplo da cobrança dito ao público ("contrato de 3 meses a R$ 3.000 por mês, na faixa de
 * 12%: valor total R$ 9.000; comissão R$ 1.080"), calculado pela regra — nenhum número escrito à mão.
 */
export function exemploCobranca(aluguelMensal = 3000, meses = 3, taxa: number = TAXA_COMISSAO_PADRAO) {
  return {
    meses,
    aluguel: brlTaxa(aluguelMensal),
    pct: pctTexto(taxa),
    total: brlTaxa(aluguelMensal * meses),
    comissao: brlTaxa(comissaoSobreContrato(aluguelMensal, meses, taxa)),
  };
}
