/**
 * Mapa único de status → texto humano. Nenhum código interno (ex.:
 * "pendente_aceite") deve aparecer na tela. Status que ainda não estão no mapa
 * viram texto legível em vez de código cru.
 */
const TEXTO: Record<string, string> = {
  // contrato
  ativo: "Ativo",
  pendente_aceite: "Aguardando aceite",
  aguardando_assinatura: "Aguardando assinatura",
  encerrado_em_acerto: "Encerrado, em acerto",
  encerrado_sem_renovacao: "Encerrado (sem renovação)",
  concluido: "Concluído",
  cancelado: "Cancelado",
  agendado: "Agendado",
  renovado: "Renovado",
  // chamado
  aberto: "Aberto",
  aguardando_usuario: "Aguardando usuário",
  aguardando_aprovacao: "Aguardando aprovação interna",
  em_andamento: "Em andamento",
  resolvido: "Resolvido",
  encerrado: "Encerrado",
  // pedido de moradia
  pausado: "Pausado",
  atendido: "Atendido",
  expirado: "Expirado",
  removido_admin: "Removido pela moderação",
};

export function statusHumano(status: string | null | undefined): string {
  if (!status) return "—";
  const conhecido = TEXTO[status];
  if (conhecido) return conhecido;
  const solto = status.replace(/_/g, " ").trim();
  return solto.charAt(0).toUpperCase() + solto.slice(1);
}
