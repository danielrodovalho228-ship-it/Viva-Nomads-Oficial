/*
  PREÇO JUSTO (ordem 4c74ac38, item 1). Lógica PURA, só recomendação. Viva: taxa da faixa do dono sobre o VALOR
  TOTAL do contrato (aluguel mensal × meses — comissaoSobreContrato, ordem do Daniel de 14/10).
  E292-bis ("a Viva só conecta"): saiu a conta do Airbnb (recebeAirbnb com a taxa de 16% e o precoSugerido de
  equivalência) — era número da Viva sobre a taxa de terceiro. O selo "Preço justo" (temSeloPrecoJusto) segue,
  comparando só o que o dono informou; a decisão sobre ele é do coordenador.
*/
import { comissaoSobreContrato, faixaPorImoveisAtivos } from "./cobranca/regra.ts";

const centavos = (v: number) => Math.round(v * 100) / 100;
const positivo = (n: number) => Number.isFinite(n) && n > 0;

/** O que o dono recebe na Viva: valor total do contrato menos a taxa da faixa. */
export function recebeViva(aluguelMensal: number, meses: number, taxa: number): number {
  if (!positivo(aluguelMensal) || !positivo(meses)) return 0;
  const total = aluguelMensal * Math.floor(meses);
  return centavos(total - comissaoSobreContrato(aluguelMensal, meses, taxa));
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

/** Peso do selo na ordem da busca: menor que um degrau de qualidade do anúncio (só desempata). */
export const IMPULSO_PRECO_JUSTO = 0.5;

/**
 * Selo "Preço justo" (ordem 4c74ac38, item 2): o aluguel mensal fica ABAIXO do equivalente mensal que o
 * dono informou ter no Airbnb. Sem o campo (opcional) ou com valor inválido, não há selo. Espelha a coluna
 * gerada `preco_justo` da migração 0130.
 */
export function temSeloPrecoJusto(aluguelMensal: number, airbnbMensal: number | null | undefined): boolean {
  if (airbnbMensal == null || !positivo(airbnbMensal) || !positivo(aluguelMensal)) return false;
  return aluguelMensal < airbnbMensal;
}

/** Prioridade na busca: degrau de qualidade do anúncio + pequeno impulso do selo. */
export function prioridadeNaBusca(prioridadeQualidade: number, precoJusto: boolean | undefined): number {
  return prioridadeQualidade + (precoJusto ? IMPULSO_PRECO_JUSTO : 0);
}

/**
 * Valida no servidor o "preço no Airbnb" vindo do formulário: undefined = não mexe; vazio/inválido/≤ 0 = limpa
 * (null); acima de R$ 1.000.000/mês é recusado como erro de digitação (limpa também). Duas casas decimais.
 */
export function colunaAirbnb(valor: number | undefined): { airbnb_monthly_price?: number | null } {
  if (valor === undefined) return {};
  if (!positivo(valor) || valor > 1_000_000) return { airbnb_monthly_price: null };
  return { airbnb_monthly_price: centavos(valor) };
}
