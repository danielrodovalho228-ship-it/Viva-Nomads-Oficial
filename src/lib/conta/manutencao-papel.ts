/**
 * E468 (PC12): o destino das "ordens de manutenção" na página de Notificações segue o papel ATIVO (o mesmo do cabeçalho).
 * Parceiro: os pedidos de serviço do painel dele. Dono e morador: Solicitações (a manutenção dos imóveis e das estadias).
 * PURO.
 */
export type PapelManutencao = "proprietario" | "morador" | "parceiro" | null;

export function destinoManutencao(papel: PapelManutencao): { href: string; rotulo: string; texto: string } {
  if (papel === "parceiro") return { href: "/dashboard/parceiro#pedidos", rotulo: "Pedidos", texto: "Nenhuma atualização por enquanto. Os pedidos de serviço ficam em" };
  return { href: "/dashboard/solicitacoes", rotulo: "Solicitações", texto: "Nenhuma atualização por enquanto. As ordens de manutenção ficam em" };
}
