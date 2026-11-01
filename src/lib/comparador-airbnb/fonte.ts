/*
  E399-C — a FONTE de dados do Airbnb, com a interface pronta para plugar o fornecedor (Apify/AirROI) depois do CNPJ
  (decisão E406 do Daniel). Hoje só existe a fonte SIMULADA: nenhuma chamada de rede.
  A simulação espelha o imóvel da Viva (o anúncio "confere"), com finais de QA no número do anúncio:
   - final 0 → cidade diferente;  - final 1 → quartos a mais.
  Roda: node --test src/lib/comparador-airbnb/pacote1.test.ts
*/
import type { DadosDoImovel } from "./antifraude.ts";

export const FONTE_SIMULADA = "simulada";

export interface FonteAirbnb {
  /** Nome gravado junto do resultado ("simulada" hoje). */
  nome: string;
  /** Cidade e quartos do anúncio no Airbnb. `referencia` é o imóvel da Viva (a simulação o espelha). */
  detalhesDoAnuncio(airbnbId: string, referencia: DadosDoImovel): Promise<DadosDoImovel>;
}

export const fonteSimulada: FonteAirbnb = {
  nome: FONTE_SIMULADA,
  async detalhesDoAnuncio(airbnbId, referencia) {
    const final = airbnbId.slice(-1);
    if (final === "0") return { cidade: "Cidade simulada diferente", quartos: referencia.quartos };
    if (final === "1") return { cidade: referencia.cidade, quartos: Number(referencia.quartos ?? 0) + 1 };
    return { cidade: referencia.cidade, quartos: referencia.quartos };
  },
};

/** A fonte em uso. Quando houver fornecedor, a troca é aqui (e só aqui). */
export function fonteAtual(): FonteAirbnb {
  return fonteSimulada;
}
