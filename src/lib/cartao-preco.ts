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
  /** "Disponível a partir de 15/11", "Disponível agora" ou null (sem data). */
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
    estadia: meses > 1 ? `${formatBRL(total)} em ${meses} meses` : null,
    total,
    meses,
    disponivel,
  };
}

/** O rótulo numa linha: "R$ X/mês · R$ Y em N meses" (ou só "R$ X/mês"). */
export function textoPreco(r: RotuloPreco): string {
  return r.estadia ? `${r.mes} · ${r.estadia}` : r.mes;
}
