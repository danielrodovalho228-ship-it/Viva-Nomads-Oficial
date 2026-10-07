import type { Property } from "@/lib/types";

/**
 * Avaliação do imóvel pela FONTE ÚNICA: as avaliações REAIS (`property.reviews`,
 * tabela `avaliacoes`, só as publicadas pelo inquilino — 0089). Cartão, página e JSON-LD devem usar isto — nunca os
 * escalares `rating`/`reviewCount` crus, que em dados de amostra divergiam (12 no
 * cartão/JSON-LD × 2 reais na página).
 *
 * Em listagens (cartões), `listProperties` sincroniza `rating`/`reviewCount` a
 * partir das mesmas avaliações publicadas (ver attachReviewAggregates); na página de detalhe
 * o array `reviews` vem carregado. Nos dois casos a contagem bate com o que o
 * usuário vê.
 */
export interface AvaliacaoResumo {
  count: number;
  value: number; // média 0–5, 1 casa decimal
}

export function avaliacaoReal(property: Pick<Property, "reviews">): AvaliacaoResumo {
  const rs = property.reviews ?? [];
  if (rs.length === 0) return { count: 0, value: 0 };
  const soma = rs.reduce((s, r) => s + (Number(r.rating) || 0), 0);
  return { count: rs.length, value: Math.round((soma / rs.length) * 10) / 10 };
}
