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

export interface TudoIncluido {
  aluguel: number;
  condominio: number;
  consumoFixo: number; // 0 quando o regime é "medido"
  total: number; // aluguel + condominio + consumoFixo
  temExtras: boolean; // total > aluguel (há condomínio e/ou consumo fixo)
}

/** Calcula o "tudo incluído" mensal de um imóvel (fonte única). */
export function calcularTudoIncluido(property: Property): TudoIncluido {
  const aluguel = property.monthlyPrice ?? 0;
  const condominio = property.condoFee ?? 0;
  const consumoFixo =
    property.utilitiesMode === "fixed" ? property.utilitiesEstimate ?? 0 : 0;
  const total = aluguel + condominio + consumoFixo;
  return { aluguel, condominio, consumoFixo, total, temExtras: total > aluguel };
}

/** Total "tudo incluído" × meses (para o total do período na busca). */
export function totalPeriodo(property: Property, meses: number): number {
  return calcularTudoIncluido(property).total * Math.max(0, Math.floor(meses));
}
