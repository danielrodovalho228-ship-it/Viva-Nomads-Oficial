/*
  E1114 (ORDEM-DUET-503) — quem mora no imóvel num dado dia. Regra pura (node --test), usada pelo pedido de avaliação:
  com o imóvel ocupado, a visita só acontece com a concordância do morador. O dia é o de BRASÍLIA (hojeEmBrasilia), nunca o
  dia em UTC: das 21:00 às 24:00 de Brasília o UTC já virou, e no último dia do bloco o morador deixava de contar.
*/

export interface BlocoDoContrato {
  inicio: string;
  fim: string;
  status: string | null;
}
export interface ContratoComBlocos {
  tenant_id: string;
  contrato_blocos: BlocoDoContrato[] | null;
}

/**
 * O contrato cujo bloco cobre o dia (AAAA-MM-DD, calendário de Brasília). O primeiro e o último dia do bloco contam
 * inteiros; bloco "não aceito" não conta.
 */
export function ocupanteNoDia<T extends ContratoComBlocos>(contratos: readonly T[], hoje: string): T | undefined {
  return contratos.find((c) => (c.contrato_blocos ?? []).some((b) => b.status !== "nao_aceito" && b.inicio <= hoje && b.fim >= hoje));
}
