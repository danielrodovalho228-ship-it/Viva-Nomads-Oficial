/**
 * E304 (QA 31/10): o link que quem indica manda ao profissional — o pedido de parceria já na categoria buscada — e a
 * cidade da busca com a UF inferida quando o nome é único no Brasil (sem UF, o "Quero ser avisado" ficava desligado).
 */
import { acharCidade } from "../cidades.ts";

export function caminhoIndicacao(categoria: string): string {
  const c = categoria && /^[a-z]+$/.test(categoria) ? categoria : "";
  return `/parceiros${c ? `?categoria=${c}` : ""}#quero-ser-parceiro`;
}

/** A UF da cidade quando ela existe em UMA UF só (ex.: "Uberlândia" → MG); ambígua ou inexistente, null. */
export function ufUnicaDaCidade(cidade: string, municipios: Record<string, readonly string[]>): { cidade: string; uf: string } | null {
  if (!cidade.trim()) return null;
  const achadas = Object.entries(municipios).flatMap(([uf, lista]) => {
    const c = acharCidade(lista, cidade);
    return c ? [{ cidade: c, uf }] : [];
  });
  return achadas.length === 1 ? achadas[0]! : null;
}
