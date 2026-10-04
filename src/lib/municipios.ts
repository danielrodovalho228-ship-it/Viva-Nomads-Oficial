import MUNICIPIOS_JSON from "@/data/municipios-ibge.json";
import { acharCidade } from "@/lib/cidades";

/** Municípios do IBGE por UF (5.570, nome oficial com acento). */
export const MUNICIPIOS = MUNICIPIOS_JSON as Record<string, string[]>;
export const UFS = Object.keys(MUNICIPIOS);

/** { cidade, uf } oficiais, ou null quando a cidade não existe naquela UF. */
export function cidadeOficial(nome: string, uf: string): { cidade: string; uf: string } | null {
  const u = (uf || "").toUpperCase().trim();
  const cidade = acharCidade(MUNICIPIOS[u], nome);
  return cidade ? { cidade, uf: u } : null;
}
