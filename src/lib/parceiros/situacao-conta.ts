/*
  E576 — a situação de parceiro da conta, para Conta › Papéis e o Início. Puro.
  Reteste de 04/11: com a parceria APROVADA e a página ainda não ativada, Papéis só oferecia "Cadastrar meu serviço"
  (como se nunca tivesse pedido) e o Início não dizia nada. A ativação mora em /dashboard/parceiro (AtivarNoPainel).
*/
export type SituacaoParceiro = "ativo" | "aprovada_sem_pagina" | "nenhum";

export const BOTAO_PARCERIA_APROVADA = "Parceria aprovada — ativar sua página";
export const TEXTO_PARCERIA_APROVADA = "Sua parceria foi aprovada. Ative sua página para completar o cadastro e começar a receber pedidos.";
export const HREF_ATIVAR_PARCERIA = "/dashboard/parceiro";

/** Com página (não suspensa) → ativo; sem página e com o pedido aprovado → aprovada_sem_pagina; senão nenhum. */
export function situacaoParceiro(e: { parceiro: { status: string } | null; solicitacao: { status: string } | null } | null | undefined): SituacaoParceiro {
  if (!e) return "nenhum";
  if (e.parceiro && e.parceiro.status !== "suspenso") return "ativo";
  if (!e.parceiro && e.solicitacao?.status === "aprovada") return "aprovada_sem_pagina";
  return "nenhum";
}
