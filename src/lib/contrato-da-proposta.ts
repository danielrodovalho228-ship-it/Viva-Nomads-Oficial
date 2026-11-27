/*
  E1086 (ORDEM-DUET-420) — cada proposta aceita gera o SEU contrato. PURO (testado em e1086-contrato-por-proposta.test.ts).
  A candidatura é uma só por morador + imóvel; uma estadia nova nasce de uma PROPOSTA nova na mesma candidatura. Por
  isso o contrato, a reserva da geração e a cobrança da taxa de serviço pertencem à PROPOSTA acordada, não à candidatura.
  Sem proposta (fechamento antigo, direto da candidatura) a chave é "nenhuma proposta", como antes.
*/

/** O valor que o índice único do banco usa no lugar de "sem proposta" (0353). */
export const PROPOSTA_NENHUMA = "00000000-0000-0000-0000-000000000000";

/**
 * O filtro pela chave do fechamento, o mesmo para a reserva (cobrancas_fechamento) e para o contrato (contratos): a
 * proposta acordada, ou as linhas SEM proposta. O que é de outra proposta da mesma candidatura (outra estadia) nunca entra.
 */
export function filtroDaChave(propostaId: string | null): { coluna: "proposta_id"; valor: string | null } {
  return { coluna: "proposta_id", valor: propostaId ?? null };
}
