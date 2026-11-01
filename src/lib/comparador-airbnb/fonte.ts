/*
  E399-C — a FONTE de dados do Airbnb, com a interface pronta para plugar o fornecedor (Apify/AirROI) depois do CNPJ
  (decisão E406 do Daniel). Hoje só existe a fonte SIMULADA: nenhuma chamada de rede.
  A simulação espelha o imóvel da Viva (o anúncio "confere"), com finais de QA no número do anúncio:
   - final 0 → cidade diferente;  - final 1 → quartos a mais.
  Roda: node --test src/lib/comparador-airbnb/pacote1.test.ts
*/
import type { DadosDoImovel } from "./antifraude.ts";
import type { CalendarioAirbnb } from "./comparacao.ts";

export const FONTE_SIMULADA = "simulada";

export interface FonteAirbnb {
  /** Nome gravado junto do resultado ("simulada" hoje). */
  nome: string;
  /** Cidade e quartos do anúncio no Airbnb. `referencia` é o imóvel da Viva (a simulação o espelha). */
  detalhesDoAnuncio(airbnbId: string, referencia: DadosDoImovel): Promise<DadosDoImovel>;
  /** Pacote 2: as próximas noites (preço por noite e disponibilidade), descontos, limpeza e taxa do hóspede. */
  calendario(airbnbId: string, inicio: Date): Promise<CalendarioAirbnb>;
}

function hash(t: string): number {
  let h = 2166136261;
  for (const c of t) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

export const fonteSimulada: FonteAirbnb = {
  nome: FONTE_SIMULADA,
  async detalhesDoAnuncio(airbnbId, referencia) {
    const final = airbnbId.slice(-1);
    if (final === "0") return { cidade: "Cidade simulada diferente", quartos: referencia.quartos };
    if (final === "1") return { cidade: referencia.cidade, quartos: Number(referencia.quartos ?? 0) + 1 };
    return { cidade: referencia.cidade, quartos: referencia.quartos };
  },
  /**
   * 60 noites a partir de `inicio`: diária-base estável por anúncio (80 a 299 reais), sexta e sábado +15%, uma noite
   * ocupada a cada 9; desconto mensal 20%, semanal 10%, limpeza R$ 150 e taxa do hóspede 14%.
   * Finais de QA: 2 → diária de 30 reais (anúncio barato: a Viva fica acima); 3 → diária de 600 reais (caro: a Viva ganha o selo).
   */
  async calendario(airbnbId, inicio) {
    const h = hash(airbnbId);
    const final = airbnbId.slice(-1);
    const base = final === "2" ? 30 : final === "3" ? 600 : 80 + (h % 220);
    const d0 = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate());
    const noites = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(d0 + i * 86_400_000);
      const fimDeSemana = d.getUTCDay() === 5 || d.getUTCDay() === 6;
      return { data: d.toISOString().slice(0, 10), preco: Math.round(base * (fimDeSemana ? 1.15 : 1)), disponivel: (h + i) % 9 !== 0 };
    });
    return { noites, descontoSemanalPct: 10, descontoMensalPct: 20, limpeza: 150, taxaHospedePct: 14 };
  },
};

/** A fonte em uso. Quando houver fornecedor, a troca é aqui (e só aqui). */
export function fonteAtual(): FonteAirbnb {
  return fonteSimulada;
}
