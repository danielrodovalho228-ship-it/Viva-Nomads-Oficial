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

/** Só pede orçamento quem tem o pedido aceito e ainda sem orçamento em aberto nem contrato. */
export function podePedirOrcamento(p: { situacao: string; temOrcamentoAberto: boolean; temContrato: boolean }): boolean {
  return p.situacao === "aceita" && !p.temOrcamentoAberto && !p.temContrato;
}

export const MSG_PEDIDO_ORCAMENTO_ENVIADO = "Pedido de orçamento enviado ao proprietário no chat.";
export const MSG_PEDIDO_ORCAMENTO_INDISPONIVEL = "Este pedido não pode pedir orçamento agora.";
