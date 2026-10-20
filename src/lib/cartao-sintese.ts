/*
  Linha-síntese do cartão (QA do Muse no Prompt 40) — PURO: "quartos · banheiros · m² · mobiliado".
  Cada item aparece SEMPRE que há o dado; item sem dado sai (nunca "—" nem "0 quartos"); a linha
  inteira só some quando nenhum dos 4 existe. O mapeamento do banco grava 0 quando o campo é nulo
  (data/properties.ts: `row.bedrooms ?? 0`), então 0 = sem dado.
*/
import { quartosTexto, banheirosTexto } from "./anuncio/plural.ts";

export type ChaveSintese = "quartos" | "banheiros" | "area" | "mobiliado";

export function itensSintese(p: {
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | null;
  furnished?: boolean | null;
}): { chave: ChaveSintese; texto: string }[] {
  const itens: { chave: ChaveSintese; texto: string }[] = [];
  if (p.bedrooms && p.bedrooms > 0) itens.push({ chave: "quartos", texto: quartosTexto(p.bedrooms) });
  if (p.bathrooms && p.bathrooms > 0) itens.push({ chave: "banheiros", texto: banheirosTexto(p.bathrooms) });
  if (p.areaM2 && p.areaM2 > 0) itens.push({ chave: "area", texto: `${p.areaM2} m²` });
  if (p.furnished === true) itens.push({ chave: "mobiliado", texto: "mobiliado" });
  return itens;
}
