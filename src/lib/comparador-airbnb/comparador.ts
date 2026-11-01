/*
  E399-C (PR 1 do selo "Preço justo") — o motor que compara o total do mês do anúncio com o valor do mesmo imóvel
  no Airbnb. Neste PR a cotação é SIMULADA: não há chamada a fornecedor (depende do CNPJ e do item 24 da agenda da
  Dra. Beatriz). A regra é a mesma do selo de hoje (temSeloPrecoJusto: total do mês ≤ Airbnb). PURO.
  Roda: node --test src/lib/comparador-airbnb/comparador.test.ts
*/
import { temSeloPrecoJusto } from "../preco-justo.ts";

export const ROTULO_SIMULADO = "Simulação: valor fictício, só para testar a comparação.";

export interface CotacaoAirbnb {
  /** Número do anúncio no Airbnb (a chave do fornecedor). */
  idAnuncio: string;
  /** Total por mês no Airbnb, já com taxas. */
  mensalTotal: number;
  /** true enquanto não houver fornecedor de verdade. */
  simulado: true;
}

export interface Comparacao {
  estado: "justo" | "acima" | "sem_valor" | "sem_cotacao";
  /** Em reais, sempre positiva: quanto fica abaixo (justo) ou acima do Airbnb. */
  diferenca: number;
  simulado: boolean;
}

/** Cotação fictícia e estável para o mesmo anúncio: R$ 2.000 a R$ 12.000 por mês, em dezenas de reais. */
export function cotacaoSimulada(idAnuncio: string): CotacaoAirbnb {
  let h = 2166136261;
  for (const c of idAnuncio) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return { idAnuncio, mensalTotal: 2000 + (h % 1001) * 10, simulado: true };
}

export function compararComAirbnb(totalMensal: number, cotacao: CotacaoAirbnb | null): Comparacao {
  if (!cotacao) return { estado: "sem_cotacao", diferenca: 0, simulado: false };
  if (!(Number.isFinite(totalMensal) && totalMensal > 0)) return { estado: "sem_valor", diferenca: 0, simulado: cotacao.simulado };
  const diferenca = Math.round(Math.abs(cotacao.mensalTotal - totalMensal) * 100) / 100;
  const estado = temSeloPrecoJusto(totalMensal, cotacao.mensalTotal) ? "justo" : "acima";
  return { estado, diferenca, simulado: cotacao.simulado };
}
