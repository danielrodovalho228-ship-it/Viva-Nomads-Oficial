/*
  Negociação configurada pelo proprietário (prompt 17, §8; o bloco entra no cadastro com o prompt 10). PURO.

  Público (properties.negociacao): aceita negociar? quais itens; descontos automáticos por estadia mais longa.
  Privado (property_negociacao_limites, só o dono): menor valor mensal aceito e limpezas máximas por mês.
  O mínimo NUNCA aparece para o interessado: abaixo dele, o aviso usa o próximo múltiplo de R$ 100 (arredondado
  para cima), sem revelar o número exato. A contraproposta em si é do prompt 17.
*/
import { CAUCAO_PARCELADA_UI } from "../faixas.ts";

export const ITENS_NEGOCIAVEIS = [
  { chave: "valor_mensal", rotulo: "Valor mensal" },
  { chave: "meses", rotulo: "Número de meses" },
  { chave: "data_entrada", rotulo: "Data de entrada" },
  { chave: "limpeza", rotulo: "Pacote de limpeza" },
  { chave: "taxa_pet", rotulo: "Taxa pet" },
  { chave: "caucao_parcelada", rotulo: "Caução parcelada" },
] as const;

export type ItemNegociavel = (typeof ITENS_NEGOCIAVEIS)[number]["chave"];

/** Itens que aparecem no cadastro (Caução parcelada só com a chave ligada). */
export function itensDisponiveis(caucaoParcelada = CAUCAO_PARCELADA_UI) {
  return ITENS_NEGOCIAVEIS.filter((i) => i.chave !== "caucao_parcelada" || caucaoParcelada);
}

export interface FaixaDesconto {
  /** A partir de quantos meses o desconto vale. */
  mesesMin: number;
  /** Percentual sobre o valor mensal (1 a 30). */
  pct: number;
}

export interface Negociacao {
  aceita: boolean;
  itens: ItemNegociavel[];
  descontos: FaixaDesconto[];
}

export const NEGOCIACAO_PADRAO: Negociacao = { aceita: false, itens: [], descontos: [] };
export const MAX_FAIXAS = 4;
export const PCT_MAX = 30;

/** Valida o que veio do formulário (o servidor chama antes de gravar). Lixo vira o padrão "não negocia". */
export function normalizarNegociacao(v: unknown, caucaoParcelada = CAUCAO_PARCELADA_UI): Negociacao {
  if (!v || typeof v !== "object" || Array.isArray(v)) return { ...NEGOCIACAO_PADRAO };
  const o = v as Record<string, unknown>;
  const permitidos = itensDisponiveis(caucaoParcelada).map((i) => i.chave) as string[];
  const itens = Array.isArray(o.itens)
    ? ([...new Set(o.itens.filter((i): i is string => typeof i === "string" && permitidos.includes(i)))] as ItemNegociavel[])
    : [];
  const descontos = Array.isArray(o.descontos)
    ? o.descontos
        .map((d) => {
          const x = (d ?? {}) as Record<string, unknown>;
          const mesesMin = Math.round(Number(x.mesesMin));
          const pct = Math.round(Number(x.pct) * 10) / 10;
          return { mesesMin, pct };
        })
        .filter((d) => Number.isFinite(d.mesesMin) && d.mesesMin >= 2 && d.mesesMin <= 12 && d.pct > 0 && d.pct <= PCT_MAX)
        .sort((a, b) => a.mesesMin - b.mesesMin)
        .filter((d, i, arr) => i === 0 || d.mesesMin !== arr[i - 1].mesesMin)
        .slice(0, MAX_FAIXAS)
    : [];
  const aceita = o.aceita === true;
  return { aceita, itens: aceita ? itens : [], descontos };
}

/** Desconto (%) que vale para uma estadia de `meses` meses: a maior faixa alcançada. */
export function descontoParaMeses(descontos: readonly FaixaDesconto[], meses: number): number {
  let pct = 0;
  for (const d of descontos) if (meses >= d.mesesMin && d.pct > pct) pct = d.pct;
  return pct;
}

/** Valor mensal com o desconto de estadia longa (arredondado ao real). Ex.: 3.200 com 6% → 3.008. */
export function valorComDesconto(valorMensal: number, pct: number): number {
  if (!(valorMensal > 0)) return 0;
  return Math.round(valorMensal * (1 - Math.max(0, Math.min(PCT_MAX, pct)) / 100));
}

/** Frase do card do anúncio: "6% de desconto a partir de 6 meses" (a maior faixa). null sem faixa. */
export function fraseDescontoCard(descontos: readonly FaixaDesconto[]): string | null {
  if (!descontos.length) return null;
  const maior = [...descontos].sort((a, b) => b.pct - a.pct || a.mesesMin - b.mesesMin)[0];
  const pct = String(maior.pct).replace(".", ",");
  return `${pct}% de desconto a partir de ${maior.mesesMin} meses`;
}

/** Selo do anúncio quando o dono não negocia. */
export const ROTULO_VALOR_FIXO = "Valor fixo";

/**
 * Aviso ao interessado quando a contraproposta fica abaixo do mínimo PRIVADO: sugere a próxima centena acima do
 * mínimo, sem revelar o número exato (2.950 → "tente a partir de R$ 3.000"). null quando não está abaixo.
 */
export function avisoAbaixoDoMinimo(proposto: number, minimo: number | null | undefined): { tenteAPartirDe: number } | null {
  if (!minimo || !(minimo > 0) || !(proposto > 0) || proposto >= minimo) return null;
  const centena = Math.ceil(minimo / 100) * 100;
  return { tenteAPartirDe: centena === minimo ? minimo + 100 : centena };
}

export interface LimitesPrivados {
  valorMinimo: number | null;
  limpezasMax: number | null;
}

export function normalizarLimites(v: unknown): LimitesPrivados {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const min = Number(o.valorMinimo);
  // Vazio = SEM LIMITE (null). Antes, Number(null) = 0 gravava "nenhuma limpeza" para todo mundo (complemento do
  // prompt 27, parte B); 0 só quando o dono escolhe "Nenhuma".
  const vazio = o.limpezasMax === null || o.limpezasMax === undefined || o.limpezasMax === "";
  const limp = vazio ? NaN : Math.round(Number(o.limpezasMax));
  return {
    valorMinimo: Number.isFinite(min) && min > 0 ? Math.round(min * 100) / 100 : null,
    limpezasMax: Number.isFinite(limp) && limp >= 0 && limp <= 8 ? limp : null,
  };
}
