/*
  Linha-síntese do cartão (QA do Muse no Prompt 40) — PURO: "quartos · banheiros · m² · mobiliado".
  Adendo 59.1: o nível abre a linha ("Conforto · 2 quartos · …"), só quando calculado (em adequação não aparece).
  É fato, não selo: o selo único da foto não muda.
  Cada item aparece SEMPRE que há o dado; item sem dado sai (nunca "—" nem "0 quartos"); a linha
  inteira só some quando nenhum dos 4 existe. O mapeamento do banco grava 0 quando o campo é nulo
  (data/properties.ts: `row.bedrooms ?? 0`), então 0 = sem dado.
*/
import { quartosTexto, banheirosTexto } from "./anuncio/plural.ts";
import { ROTULO_NIVEL, type NivelOuAdequacao } from "../config/niveis.ts";

export type ChaveSintese = "nivel" | "quartos" | "banheiros" | "area" | "mobiliado";

export function itensSintese(p: {
  bedrooms?: number | null;
  bathrooms?: number | null;
  areaM2?: number | null;
  furnished?: boolean | null;
  nivel?: NivelOuAdequacao | null;
}): { chave: ChaveSintese; texto: string }[] {
  const itens: { chave: ChaveSintese; texto: string }[] = [];
  if (p.nivel && p.nivel !== "em_adequacao") itens.push({ chave: "nivel", texto: ROTULO_NIVEL[p.nivel] });
  if (p.bedrooms && p.bedrooms > 0) itens.push({ chave: "quartos", texto: quartosTexto(p.bedrooms) });
  if (p.bathrooms && p.bathrooms > 0) itens.push({ chave: "banheiros", texto: banheirosTexto(p.bathrooms) });
  if (p.areaM2 && p.areaM2 > 0) itens.push({ chave: "area", texto: `${p.areaM2} m²` });
  if (p.furnished === true) itens.push({ chave: "mobiliado", texto: "mobiliado" });
  return itens;
}
