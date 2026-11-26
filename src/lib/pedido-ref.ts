/**
 * E440 (orçamento numerado): o número PÚBLICO do pedido do morador (a candidatura/lead), "VN-PD-11281A61" — a mesma
 * regra do número do contrato (VN-CT, contrato-ref.ts), a partir do id. O pedido liga o orçamento (proposta ORC-…) e o
 * contrato (contratos.lead_id): os três números contam a mesma história. Puro.
 */
export function numeroPublicoPedido(leadId: string | null | undefined): string | null {
  return leadId && /^[0-9a-f-]{8,}$/i.test(leadId) ? `VN-PD-${leadId.slice(0, 8).toUpperCase()}` : null;
}

/** A linha que a tela do contrato mostra: o pedido e, quando há, o orçamento que virou este contrato. */
export function linhaNumerosDoContrato(pedido: string | null, orcamento: string | null): string | null {
  if (!pedido && !orcamento) return null;
  return [pedido ? `Pedido do morador: ${pedido}` : null, orcamento ? `Orçamento: ${orcamento}` : null].filter(Boolean).join(" · ");
}

/** "Pedir orçamento": a mensagem que vai ao dono no chat da plataforma, com o número do pedido. Sem contato, sem link. */
export function textoPedirOrcamento(numeroPedido: string): string {
  return `Olá! Pode me enviar um orçamento pela plataforma para o pedido ${numeroPedido}? Obrigado.`;
}

/** Os estados da proposta que contam como "orçamento em aberto" (o servidor e o cartão leem a mesma lista). */
export const ORCAMENTO_ABERTO: string[] = ["enviada", "vista", "contraproposta"];

/** E1088: o que a regra precisa de cada contrato da candidatura. */
export interface ContratoDoPedido {
  status?: string | null;
  assinadoProprietarioEm: string | null;
  assinadoInquilinoEm: string | null;
}

/**
 * Só pede orçamento quem tem o pedido aceito, sem orçamento em aberto, e com TODOS os contratos dessa candidatura
 * assinados pelas duas partes, ou nenhum (E1088). O contrato cancelado não conta (ORDEM-605).
 */
/**
 * E1088 (ORDEM-DUET-728): o contrato que manda no selo do cartão é o mesmo que conta na regra — entre os que não estão
 * cancelados, o mais recente. Só com cancelados, o mais recente deles (o cartão não perde o selo). Antes o selo vinha
 * do último que a consulta devolvia, sem ordem.
 */
export function contratoDoSelo<T extends { status?: string | null; created_at?: string | null }>(contratos: readonly T[]): T | null {
  const maisRecente = (lista: readonly T[]) =>
    lista.reduce<T | null>((m, c) => (!m || Date.parse(String(c.created_at ?? "")) > Date.parse(String(m.created_at ?? "")) ? c : m), null);
  return maisRecente(contratos.filter((c) => c.status !== "cancelado")) ?? maisRecente(contratos);
}

export function podePedirOrcamento(p: { situacao: string; temOrcamentoAberto: boolean; contratos: readonly ContratoDoPedido[] }): boolean {
  return (
    p.situacao === "aceita" &&
    !p.temOrcamentoAberto &&
    p.contratos.filter((c) => c.status !== "cancelado").every((c) => !!c.assinadoProprietarioEm && !!c.assinadoInquilinoEm)
  );
}

export const MSG_PEDIDO_ORCAMENTO_ENVIADO = "Pedido de orçamento enviado ao proprietário no chat.";
export const MSG_PEDIDO_ORCAMENTO_INDISPONIVEL = "Este pedido não pode pedir orçamento agora.";
