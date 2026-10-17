/*
  PROXIMIDADES DA PÁGINA DO IMÓVEL (ordem dd15064d, D8 e D9) — regra pura.
  Uma fonte só para "Destaques" e "O que tem por perto": mesma lista, mesma
  distância aproximada. Sem dado, a linha não existe (nada é inventado).
*/
import type { Property, Proximity } from "../types";

/** Passo médio a pé: 80 m por minuto. */
const METROS_POR_MINUTO = 80;

/**
 * Distância APROXIMADA para o anúncio público: arredonda os minutos para o
 * múltiplo de 5 mais próximo (mín. 5) e prefixa "~", para não dar precisão que
 * ajude a triangular o endereço antes do aceite. Sem minutos no texto, devolve nada.
 */
export function distanciaAprox(note?: string): string | undefined {
  if (!note) return undefined;
  const m = note.match(/(\d+)\s*min/i);
  if (!m) return undefined;
  const min = parseInt(m[1], 10);
  if (!Number.isFinite(min)) return undefined;
  const arred = Math.max(5, Math.round(min / 5) * 5);
  const modo = /p[ée]/i.test(note) ? " a pé" : /carro|autom[óo]vel|dirig/i.test(note) ? " de carro" : "";
  return `~${arred} min${modo}`;
}

/**
 * Lista de proximidades do anúncio. Se o dono não cadastrou nenhuma, usa os
 * espaços de trabalho que ele já informou com distância (metros → minutos a pé).
 */
export function proximidadesDoImovel(p: Property): Proximity[] {
  const manuais = (p.proximities ?? []).filter((x) => x.name.trim());
  if (manuais.length > 0) return manuais;
  return (p.nearbyWorkspaces ?? [])
    .filter((w) => w.name.trim() && Number.isFinite(w.distanceM) && w.distanceM > 0)
    .map((w) => ({
      category: "trabalho" as const,
      name: w.name.trim(),
      note: `${Math.max(1, Math.round(w.distanceM / METROS_POR_MINUTO))} min a pé`,
    }));
}
