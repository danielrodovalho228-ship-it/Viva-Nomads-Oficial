/*
  FILTROS-2 — o padrão mínimo de 12 itens é GARANTIA da plataforma na busca (decisão do dono, 23/10). PURO.

  - Item do mínimo não vira chip de filtro (filtrar por obrigatório não faz sentido): a folha mostra a linha de garantia.
  - Anúncio que não cumpre o mínimo está "em adequação" e não aparece nos resultados — nenhuma combinação de filtros o
    traz de volta (a regra vale antes dos filtros, na base da busca).
*/
import { ITENS_CONFORTO } from "../../config/conforto-minimo.ts";
import type { NivelOuAdequacao } from "../../config/niveis.ts";

/** Linha da folha de filtros, no lugar dos chips Wi-Fi e Cozinha equipada. */
export const TEXTO_GARANTIA_MINIMA = `Padrão mínimo Viva em todos os imóveis: internet Wi-Fi, cozinha equipada e mais ${ITENS_CONFORTO.length - 2} itens.`;

/** O anúncio pode aparecer nos resultados? Em adequação (abaixo do mínimo) nunca. */
export function cumpreGarantiaMinima(p: { nivel?: NivelOuAdequacao | null }): boolean {
  return p.nivel !== "em_adequacao";
}
