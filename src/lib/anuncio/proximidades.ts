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

/** Serviços do dia a dia que a pessoa procura no anúncio (adendo do prompt 37). */
export type TipoServico = "onibus" | "mercado" | "farmacia";
export const SERVICOS: readonly { tipo: TipoServico; rotulo: string; frase: string }[] = [
  { tipo: "onibus", rotulo: "Ônibus", frase: "Ponto de ônibus mais perto" },
  { tipo: "mercado", rotulo: "Mercado", frase: "Mercado mais perto" },
  { tipo: "farmacia", rotulo: "Farmácia", frase: "Farmácia mais perto" },
];

const FARMACIA = /farm[aá]cia|drogaria|drogasil|droga raia|pague menos|panvel|ultrafarma/i;

export function tipoServico(p: Proximity): TipoServico | null {
  if (p.category === "transporte") return "onibus";
  if (p.category === "mercado") return "mercado";
  if (p.category === "saude" && FARMACIA.test(p.name)) return "farmacia";
  return null;
}

const minutosDaNota = (note?: string) => {
  const m = note?.match(/(\d+)\s*min/i);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
};

/**
 * Por serviço, o tempo APROXIMADO até o mais perto — sem o nome do lugar (o nome ajudaria a achar o endereço antes
 * do aceite; a lista com nomes continua limitada). Serviço sem dado não aparece.
 */
export function servicosPorPerto(lista: Proximity[]): { tipo: TipoServico; rotulo: string; texto: string }[] {
  const out: { tipo: TipoServico; rotulo: string; texto: string }[] = [];
  for (const s of SERVICOS) {
    const doTipo = lista.filter((p) => tipoServico(p) === s.tipo && distanciaAprox(p.note));
    if (!doTipo.length) continue;
    const perto = doTipo.reduce((a, b) => (minutosDaNota(b.note) < minutosDaNota(a.note) ? b : a));
    out.push({ tipo: s.tipo, rotulo: s.rotulo, texto: `${s.frase}: ${distanciaAprox(perto.note)}` });
  }
  return out;
}
