/*
  E176 (D1) — "Ganhos" do dono (subaba de Contratos). PURO: a partir das linhas da carteira, só os contratos em vigência
  (ocupado) e a começar (reservado), com a soma de cada grupo. Vago não entra. Roda: node --test src/lib/ganhos-dono.test.ts
*/
import type { ItemCarteira } from "./carteira-dono.ts";

export interface Ganhos {
  vigencia: number;
  aComecar: number;
  linhas: ItemCarteira[];
}

export function ganhosDoDono(itens: readonly ItemCarteira[]): Ganhos {
  const linhas = itens
    .filter((i) => (i.situacao === "ocupado" || i.situacao === "reservado") && i.valorMensal > 0)
    .sort((a, b) => (a.situacao === b.situacao ? (a.inicio ?? "").localeCompare(b.inicio ?? "") : a.situacao === "ocupado" ? -1 : 1));
  const soma = (s: ItemCarteira["situacao"]) => linhas.filter((l) => l.situacao === s).reduce((t, l) => t + l.valorMensal, 0);
  return { vigencia: soma("ocupado"), aComecar: soma("reservado"), linhas };
}
