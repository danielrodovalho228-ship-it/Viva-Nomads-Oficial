/*
  PREÇO JUSTO (ordem 4c74ac38, item 1) — "Quanto você recebe" Viva × Airbnb. Lógica PURA, só recomendação.
  Airbnb: taxa única MERCADO.airbnbTaxa sobre o total da estadia. Viva: taxa da faixa do dono sobre o VALOR
  TOTAL do contrato (aluguel mensal × meses — comissaoSobreContrato, ordem do Daniel de 14/10).
*/
import { MERCADO } from "../config/planos.ts";
import { comissaoSobreContrato, faixaPorImoveisAtivos } from "./cobranca/regra.ts";

const centavos = (v: number) => Math.round(v * 100) / 100;
const positivo = (n: number) => Number.isFinite(n) && n > 0;

/** O que o dono recebe de um total de estadia cobrado no Airbnb. */
export function recebeAirbnb(totalAirbnb: number): number {
  return positivo(totalAirbnb) ? centavos(totalAirbnb * (1 - MERCADO.airbnbTaxa)) : 0;
}

/** O que o dono recebe na Viva: valor total do contrato menos a taxa da faixa. */
export function recebeViva(aluguelMensal: number, meses: number, taxa: number): number {
  if (!positivo(aluguelMensal) || !positivo(meses)) return 0;
  const total = aluguelMensal * Math.floor(meses);
  return centavos(total - comissaoSobreContrato(aluguelMensal, meses, taxa));
}

/**
 * Menor valor mensal (em reais inteiros) com que o dono recebe, na Viva, pelo menos o mesmo que
 * receberia no Airbnb. null = entrada inválida.
 */
export function precoSugerido(totalAirbnb: number, meses: number, taxa: number): number | null {
  if (!positivo(totalAirbnb) || !positivo(meses) || !Number.isFinite(taxa) || taxa < 0 || taxa >= 1) return null;
  const m = Math.floor(meses);
  if (m < 1) return null;
  let p = Math.ceil(recebeAirbnb(totalAirbnb) / (m * (1 - taxa)));
  while (recebeViva(p, m, taxa) < recebeAirbnb(totalAirbnb)) p += 1; // arredondamento de centavos
  return p;
}

/** Quanto o morador economiza no total da estadia pagando `aluguelMensal` em vez do total do Airbnb. */
export function economiaDoMorador(totalAirbnb: number, aluguelMensal: number, meses: number): { reais: number; pct: number } {
  if (!positivo(totalAirbnb) || !positivo(aluguelMensal) || !positivo(meses)) return { reais: 0, pct: 0 };
  const reais = centavos(totalAirbnb - aluguelMensal * Math.floor(meses));
  return { reais, pct: reais / totalAirbnb };
}

/**
 * Taxa que o dono pagaria ao fechar este anúncio: a da faixa pelos imóveis ativos DELE já contando o que
 * está cadastrando (ativos + 1). Entrada inválida cai na faixa de 1–2 imóveis.
 */
export function taxaDoNovoAnuncio(imoveisAtivos: number): number {
  const n = Number.isFinite(imoveisAtivos) && imoveisAtivos > 0 ? Math.floor(imoveisAtivos) : 0;
  return faixaPorImoveisAtivos(n + 1).taxa;
}
