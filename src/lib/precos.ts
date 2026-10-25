/*
  Preço "tudo incluído" — FONTE ÚNICA da verdade (corrige a divergência do E2E:
  o card somava aluguel + consumo e a página do imóvel somava aluguel + condomínio
  + consumo, exibindo valores diferentes para o mesmo imóvel).

  Regra: "tudo incluído" = ALUGUEL + CONDOMÍNIO + CONSUMO FIXO estimado.
  - condomínio: entra sempre que houver (custo mensal recorrente do imóvel).
  - consumo: só quando o regime é "fixo" (valor estimado no contrato); no regime
    "medido" o consumo é variável e não entra no número exibido.

  Pura e client-safe: usada pelo card da busca, pela página do imóvel e por
  qualquer outra superfície — todas convergem para o mesmo valor.
*/

import type { Property } from "@/lib/types";
import { formatBRL } from "./utils.ts";
import type { LimpezaEstadia } from "./anuncio/limpeza-estadia.ts";

export interface TudoIncluido {
  aluguel: number;
  condominio: number;
  consumoFixo: number; // 0 quando o regime é "medido"
  limpezaMes: number; // pacote de limpeza durante a estadia (0 = sem pacote ou já incluído no mensal)
  total: number; // aluguel + condominio + consumoFixo + limpezaMes
  temExtras: boolean; // total > aluguel (há condomínio e/ou consumo fixo)
}

/** Campos que entram no total do mês (o resto do imóvel não importa para a conta). */
export type CamposTotalMes = Pick<Property, "monthlyPrice" | "condoFee" | "utilitiesMode" | "utilitiesEstimate" | "limpezaEstadia">;

/** Calcula o "tudo incluído" mensal de um imóvel (fonte única). */
export function calcularTudoIncluido(property: CamposTotalMes): TudoIncluido {
  const aluguel = property.monthlyPrice ?? 0;
  const condominio = property.condoFee ?? 0;
  const consumoFixo =
    property.utilitiesMode === "fixed" ? property.utilitiesEstimate ?? 0 : 0;
  const limpezaMes = property.limpezaEstadia && property.limpezaEstadia.valorMes > 0 ? property.limpezaEstadia.valorMes : 0;
  const total = aluguel + condominio + consumoFixo + limpezaMes;
  return { aluguel, condominio, consumoFixo, limpezaMes, total, temExtras: total > aluguel };
}

/** Total "tudo incluído" × meses (para o total do período na busca). */
export function totalPeriodo(property: Property, meses: number): number {
  return calcularTudoIncluido(property).total * Math.max(0, Math.floor(meses));
}

/*
  CUSTO TOTAL DO MÊS (ordem 1a555bfa) — a mesma conta na página do imóvel, no cartão
  da busca/home e na barra fixa do celular. O total é o mesmo de calcularTudoIncluido.
  Pagamentos únicos (preparação, limpeza de saída) ficam FORA do total; IPTU não
  existe no cadastro, então o texto avisa que não está incluso.
*/
export interface LinhaTotalMensal {
  chave: "mensal" | "condominio" | "contas" | "limpeza" | "viva";
  rotulo: string;
  valor: number;
  /** Pacote de limpeza sem custo extra: a linha diz "incluída no valor mensal" e soma 0. */
  incluida?: boolean;
  /** Contas fixas são estimativa combinada no contrato. */
  estimativa?: boolean;
}

export interface PagamentoUnico {
  chave: "preparacao" | "saida";
  rotulo: string;
  valor: number;
}

export interface TotalMensal {
  total: number;
  linhas: LinhaTotalMensal[];
  unicos: PagamentoUnico[];
  /** Regime "real": o consumo é medido e não entra no total. */
  contasMedidas: boolean;
  iptuNaoIncluso: true;
}

const positivo = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;

export function calcularTotalMensal(property: Property): TotalMensal {
  const inc = calcularTudoIncluido(property);
  const linhas: LinhaTotalMensal[] = [{ chave: "mensal", rotulo: "Valor mensal", valor: inc.aluguel }];
  if (positivo(inc.condominio)) linhas.push({ chave: "condominio", rotulo: "Condomínio", valor: inc.condominio });
  if (positivo(inc.consumoFixo)) {
    linhas.push({ chave: "contas", rotulo: "Água, luz e gás (estimativa)", valor: inc.consumoFixo, estimativa: true });
  }
  const pacote: LimpezaEstadia | null | undefined = property.limpezaEstadia;
  if (pacote) {
    const qtd = pacote.porMes === 1 ? "1 por mês" : `${pacote.porMes} por mês`;
    if (inc.limpezaMes > 0) linhas.push({ chave: "limpeza", rotulo: `Limpeza durante a estadia (${qtd})`, valor: inc.limpezaMes });
    else linhas.push({ chave: "limpeza", rotulo: `Limpeza durante a estadia (${qtd}): incluída no valor mensal`, valor: 0, incluida: true });
  }
  linhas.push({ chave: "viva", rotulo: "Taxa da Viva para você", valor: 0 });
  const unicos: PagamentoUnico[] = [];
  if (positivo(property.prepFee)) unicos.push({ chave: "preparacao", rotulo: "Limpeza de preparação", valor: property.prepFee });
  if (property.checkoutCleaningEnabled && positivo(property.checkoutCleaningFee)) {
    unicos.push({ chave: "saida", rotulo: "Limpeza de saída", valor: property.checkoutCleaningFee });
  }
  return {
    total: inc.total,
    linhas,
    unicos,
    contasMedidas: property.utilitiesMode !== "fixed",
    iptuNaoIncluso: true,
  };
}

/** Total do mês de uma linha do banco (snake_case) — para respostas, alertas e e-mails que leem a tabela direto. */
export function totalMesDaLinha(r: { monthly_price?: number | null; condo_fee?: number | null; utilities_mode?: string | null; utilities_estimate?: number | null }): number {
  return calcularTudoIncluido({
    monthlyPrice: Number(r.monthly_price ?? 0),
    condoFee: r.condo_fee == null ? undefined : Number(r.condo_fee),
    utilitiesMode: r.utilities_mode === "fixed" ? "fixed" : undefined,
    utilitiesEstimate: r.utilities_estimate == null ? undefined : Number(r.utilities_estimate),
    limpezaEstadia: undefined,
  } as CamposTotalMes).total;
}

/**
 * Total do mês no FECHAMENTO (Prompt 47, adendo): a mesma conta do cartão, com o valor mensal acordado na proposta
 * quando houver. O total do período do fechamento = rotuloPreco({ mensal: isto, meses }).total — igual ao do cartão.
 */
export function mensalDoFechamento(property: CamposTotalMes, valorMensalAcordado?: number | null): number {
  const mensal = valorMensalAcordado && valorMensalAcordado > 0 ? valorMensalAcordado : property.monthlyPrice;
  return calcularTudoIncluido({ ...property, monthlyPrice: mensal }).total;
}

/** Anota o total do mês (mesma conta do cartão) para filtro, ordem e pino da busca. */
export function comTotalMes<T extends Property>(property: T): T & { totalMes: number } {
  return { ...property, totalMes: calcularTotalMensal(property).total };
}

/** Textos do cartão: total em destaque e o detalhe menor embaixo. */
export function textosTotalMensal(property: Property): { destaque: string; detalhe: string } {
  const t = calcularTotalMensal(property);
  const extras: string[] = [];
  if (t.linhas.some((l) => l.chave === "condominio")) extras.push("condomínio");
  if (t.linhas.some((l) => l.chave === "contas")) extras.push("contas");
  if (t.linhas.some((l) => l.chave === "limpeza" && !l.incluida)) extras.push("limpeza");
  let detalhe = `Valor mensal ${formatBRL(t.linhas[0].valor)}`;
  if (extras.length > 0) detalhe += ` + ${extras.join(" e ")}`;
  else if (t.contasMedidas) detalhe += " + consumo medido";
  return { destaque: `${formatBRL(t.total)}/mês total`, detalhe };
}

/*
  PROP-2 — PREÇO NUMA FONTE SÓ, SEMPRE COM RÓTULO. Toda tela que mostra valor de imóvel, proposta ou contrato passa
  por precoRotulado: "Mensal" (o aluguel), "Total por mês (com contas)" e "Total do contrato" — este sempre com a conta
  aberta ("4 × R$ 3.400 + limpeza de preparação R$ 450 = R$ 14.050"). Nada de número solto sem nome.
*/
export const ROTULO_MENSAL = "Mensal";
export const ROTULO_TOTAL_MES = "Total por mês (com contas)";
export const ROTULO_TOTAL_CONTRATO = "Total do contrato";

export interface ParcelaPreco {
  rotulo: string;
  valor: number;
}

export interface EntradaPreco {
  /** Aluguel do mês (já com desconto, se houver). */
  mensal: number;
  /** O que entra todo mês além do aluguel (condomínio, contas, limpezas, taxa pet), na ordem de exibição. */
  extrasMes?: ParcelaPreco[];
  /** Duração em meses; sem duração não há total do contrato. */
  meses?: number | null;
  /** Pagamentos únicos que entram no total do contrato (preparação, saída). */
  unicos?: ParcelaPreco[];
}

export interface PrecoRotulado {
  mensal: number;
  totalPorMes: number;
  totalContrato: number | null;
  meses: number | null;
  /** Parcelas do mês (a 1ª é sempre o "Mensal"); somam totalPorMes. */
  parcelasMes: ParcelaPreco[];
  unicos: ParcelaPreco[];
  /** A conta do total do contrato, por extenso; null sem duração. */
  conta: string | null;
}

const centavos = (n: number) => Math.round(n * 100) / 100;

export function precoRotulado(e: EntradaPreco): PrecoRotulado {
  const mensal = centavos(Number(e.mensal) || 0);
  const extras = (e.extrasMes ?? []).filter((p) => positivo(p.valor)).map((p) => ({ rotulo: p.rotulo, valor: centavos(p.valor) }));
  const unicos = (e.unicos ?? []).filter((p) => positivo(p.valor)).map((p) => ({ rotulo: p.rotulo, valor: centavos(p.valor) }));
  const parcelasMes = [{ rotulo: ROTULO_MENSAL, valor: mensal }, ...extras];
  const totalPorMes = centavos(parcelasMes.reduce((s, p) => s + p.valor, 0));
  const meses = e.meses != null && Number.isFinite(e.meses) && e.meses > 0 ? Math.round(e.meses) : null;
  if (meses == null) return { mensal, totalPorMes, totalContrato: null, meses: null, parcelasMes, unicos, conta: null };
  const totalContrato = centavos(totalPorMes * meses + unicos.reduce((s, p) => s + p.valor, 0));
  const partes = [`${meses} × ${formatBRL(totalPorMes)}`, ...unicos.map((u) => `${u.rotulo.toLowerCase()} ${formatBRL(u.valor)}`)];
  return { mensal, totalPorMes, totalContrato, meses, parcelasMes, unicos, conta: `${partes.join(" + ")} = ${formatBRL(totalContrato)}` };
}

/** Preço de um IMÓVEL (anúncio): as mesmas parcelas de calcularTudoIncluido, com rótulo; os únicos do anúncio. */
export function precoDoImovel(
  p: CamposTotalMes & Partial<Pick<Property, "prepFee" | "checkoutCleaningEnabled" | "checkoutCleaningFee">>,
  meses?: number | null,
): PrecoRotulado {
  const inc = calcularTudoIncluido(p);
  const unicos: ParcelaPreco[] = [];
  if (positivo(p.prepFee)) unicos.push({ rotulo: "Limpeza de preparação", valor: p.prepFee });
  if (p.checkoutCleaningEnabled && positivo(p.checkoutCleaningFee)) unicos.push({ rotulo: "Limpeza de saída", valor: p.checkoutCleaningFee });
  return precoRotulado({
    mensal: inc.aluguel,
    extrasMes: [
      { rotulo: "Condomínio", valor: inc.condominio },
      { rotulo: "Água, luz e gás (estimativa)", valor: inc.consumoFixo },
      { rotulo: "Limpeza durante a estadia", valor: inc.limpezaMes },
    ],
    meses,
    unicos,
  });
}

/** Termos de uma versão de proposta (os mesmos campos de TermosProposta; os totais batem com calcularTotais). */
export interface TermosPreco {
  valorMensal: number;
  meses: number;
  condominio: number;
  consumo: number;
  limpezasMes: number;
  valorLimpeza: number;
  taxaPet: number;
  limpezaUnica: number;
}

/** Preço de uma PROPOSTA (qualquer versão) ou do contrato que nasceu dela. */
export function precoDaProposta(t: TermosPreco): PrecoRotulado {
  const qtd = Math.round(Number(t.limpezasMes) || 0);
  return precoRotulado({
    mensal: t.valorMensal,
    extrasMes: [
      { rotulo: "Condomínio", valor: Number(t.condominio) || 0 },
      { rotulo: "Consumo estimado", valor: Number(t.consumo) || 0 },
      { rotulo: `Limpezas (${qtd}/mês)`, valor: qtd * (Number(t.valorLimpeza) || 0) },
      { rotulo: "Taxa pet", valor: Number(t.taxaPet) || 0 },
    ],
    meses: t.meses,
    unicos: [{ rotulo: "Limpeza de preparação", valor: Number(t.limpezaUnica) || 0 }],
  });
}
