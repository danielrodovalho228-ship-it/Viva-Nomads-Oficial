/*
  Preço com contexto (Prompt 47, item f) — PURO. UMA função para toda superfície que mostra o valor mensal de um
  imóvel: busca, cartão, pino do mapa, página do imóvel, rodapé fixo, favoritos, comparar, alertas e e-mails, a lista
  de imóveis do dono, a resposta ao pedido de moradia e o fechamento.
    • "R$ X/mês" — X é o total do mês (valor mensal + condomínio + consumo fixo + limpeza; a fonte única de precos.ts);
    • "R$ Y em N meses" — o total do período (N = duração da busca/acordo ou a estadia mínima; com N = 1, nada);
    • "Disponível a partir de dd/mm" (ou "Disponível agora").
  Adendo (Daniel, 21/10): o total do cartão é EXATAMENTE o total do fechamento para a mesma duração — os dois saem de
  totalDoPeriodo, conta em centavos.
*/
import { formatBRL } from "./utils.ts";
import { disponivelAPartirDe } from "./busca/disponibilidade.ts";

/** Meses do total da estadia: a duração da busca ou, sem busca, a estadia mínima do imóvel. */
export function mesesDoCartao(periodMonths: number | undefined, minPeriodDays: number | undefined): number {
  if (periodMonths && periodMonths > 0) return periodMonths;
  return Math.max(1, Math.ceil((minPeriodDays ?? 30) / 30));
}

/** Total do período em reais, calculado em centavos (o mesmo número no cartão e no fechamento). */
/** E777: o resumo "R$ X em N meses" (singular: "em 1 mês") — a ÚNICA forma de escrever o total do período; cartão, barra fixa,
 *  página do imóvel e reserva usam esta função. O X vem de quem calcula (precos.ts / estadiaDoImovel), nunca é refeito aqui. */
export function resumoEmMeses(total: number, meses: number): string {
  return `${formatBRL(total)} em ${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function totalDoPeriodo(mensal: number, meses: number): number {
  const n = Math.max(0, Math.floor(meses));
  return (Math.round((Number.isFinite(mensal) ? mensal : 0) * 100) * n) / 100;
}

export interface RotuloPreco {
  /** "R$ X" */
  valor: string;
  /** "R$ X/mês" */
  mes: string;
  /** "R$ Y em N meses" (null com N ≤ 1). */
  estadia: string | null;
  /** Y em reais (o total do período; com N ≤ 1, o próprio mensal). */
  total: number;
  meses: number;
  /** "Disponível a partir de 15/11/2026", "Disponível agora" ou null (sem data). */
  disponivel: string | null;
}

export function rotuloPreco(p: { mensal: number; meses?: number | null; disponivelEm?: string | null; hoje?: Date }): RotuloPreco {
  const meses = Math.max(1, Math.floor(p.meses ?? 1));
  const valor = formatBRL(p.mensal);
  const total = totalDoPeriodo(p.mensal, meses);
  let disponivel: string | null = null;
  if (p.disponivelEm && /^\d{4}-\d{2}-\d{2}/.test(p.disponivelEm)) {
    const quando = disponivelAPartirDe(p.disponivelEm, p.hoje ?? new Date());
    disponivel = quando ? `Disponível a partir de ${quando}` : "Disponível agora";
  }
  return {
    valor,
    mes: `${valor}/mês`,
    estadia: meses > 1 ? resumoEmMeses(total, meses) : null,
    total,
    meses,
    disponivel,
  };
}

/** O rótulo numa linha: "R$ X/mês · R$ Y em N meses" (ou só "R$ X/mês"). */
export function textoPreco(r: RotuloPreco): string {
  return r.estadia ? `${r.mes} · ${r.estadia}` : r.mes;
}

/** E356: texto do total da estadia no CARTÃO da busca. Todo cartão da mesma grade mostra a linha (com 1 mês, "R$ X em 1 mês"), para a
 *  comparação de preço não depender de o vizinho ter ou não estadia mínima plurimensal. As demais superfícies seguem o `estadia` (null com N = 1). */
export function estadiaDoCartao(r: RotuloPreco): string {
  return r.estadia ?? resumoEmMeses(r.total, 1);
}

/** E356: o rótulo que diz o que o preço grande do cartão é. */
export const ROTULO_TOTAL_MES = "Total por mês, tudo incluído";

/**
 * E702: a data "Disponível a partir de" da página do imóvel é CALCULADA (primeira entrada em que cabe a estadia mínima,
 * olhando os períodos ocupados). Quando ela difere da data do cadastro, o cartão diz de onde vem; quando é a mesma, nada.
 */
export function notaDataCalculada(calculada: string | null | undefined, doCadastro: string | null | undefined, minDias: number | null | undefined): string | null {
  const a = calculada?.slice(0, 10);
  if (!a || !/^\d{4}-\d{2}-\d{2}$/.test(a)) return null;
  if (a === (doCadastro ?? "").slice(0, 10)) return null;
  const n = Number(minDias);
  const dias = Number.isFinite(n) && n > 0 ? ` de ${n} ${n === 1 ? "dia" : "dias"}` : "";
  return `Data calculada para a estadia mínima${dias}, olhando os períodos já ocupados.`;
}
