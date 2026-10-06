/*
  Assistente Viva — modelo configurável e custo estimado (PURO).
  ATENDIMENTO_IA_MODELO escolhe o modelo (padrão: o atual). O "Testar a Viva"
  usa estes preços para mostrar o custo por conversa e por mês, em reais,
  e comparar modelos. Preços da Anthropic em US$ por milhão de tokens.
*/

export const MODELO_PADRAO = "claude-opus-5-5";

interface Preco {
  rotulo: string;
  entrada: number;
  saida: number;
  cacheLida: number;
}

/** US$ por milhão de tokens (tabela pública da Anthropic). Escrita no cache = 1,25 × entrada. */
export const PRECOS_USD: Record<string, Preco> = {
  "claude-opus-5-5": { rotulo: "Claude Opus 5.5", entrada: 4, saida: 20, cacheLida: 0.2 },
  "claude-opus-5": { rotulo: "Claude Opus 5", entrada: 5, saida: 25, cacheLida: 0.5 },
  "claude-opus-4-8": { rotulo: "Claude Opus 4.8", entrada: 5, saida: 25, cacheLida: 0.5 },
  "claude-sonnet-5-5": { rotulo: "Claude Sonnet 5.5", entrada: 2, saida: 10, cacheLida: 0.2 },
  "claude-sonnet-5": { rotulo: "Claude Sonnet 5", entrada: 2, saida: 10, cacheLida: 0.2 },
  "claude-haiku-4-5": { rotulo: "Claude Haiku 4.5", entrada: 1, saida: 5, cacheLida: 0.1 },
};

/** Modelo da Viva: ATENDIMENTO_IA_MODELO (só ids claude-…), senão o padrão. */
export function modeloViva(valor: string | undefined = process.env.ATENDIMENTO_IA_MODELO): string {
  const v = (valor ?? "").trim();
  return /^claude-[a-z0-9-]{3,60}$/.test(v) ? v : MODELO_PADRAO;
}

/** Reserva automática (outro modelo tenta de novo se este recusar): só onde a API aceita a forma com lista. */
export function aceitaReserva(modelo: string): boolean {
  return ["claude-opus-5-5", "claude-opus-5"].includes(modelo);
}

/** O parâmetro de esforço não existe no Haiku 4.5. */
export function aceitaEsforco(modelo: string): boolean {
  return !modelo.startsWith("claude-haiku");
}

export interface UsoTokens {
  entrada: number;
  saida: number;
  cacheLida: number;
  cacheEscrita: number;
}

/** Custo em US$ de um uso; null se o modelo não está na tabela. */
export function custoUsd(modelo: string, u: UsoTokens): number | null {
  const p = PRECOS_USD[modelo];
  if (!p) return null;
  return (u.entrada * p.entrada + u.cacheEscrita * p.entrada * 1.25 + u.cacheLida * p.cacheLida + u.saida * p.saida) / 1_000_000;
}

/** Cotação usada na conta (ATENDIMENTO_IA_DOLAR, padrão 5,50). */
export function cotacaoDolar(valor: string | undefined = process.env.ATENDIMENTO_IA_DOLAR): number {
  const n = Number((valor ?? "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 5.5;
}
