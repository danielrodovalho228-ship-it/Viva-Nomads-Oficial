/**
 * Vocabulário ÚNICO do status da candidatura na tela do INQUILINO.
 *
 * Regra de produto: a tela do inquilino NUNCA diz "recusada/rejeitada" — o
 * estado é digno ("Não seguiu adiante"). O acompanhamento mostra todos os
 * estados (não é uma página de más notícias), então o mapeamento é fonte única
 * aqui e reusado pela página /dashboard/candidaturas e por qualquer resumo.
 *
 * Função pura e client-safe (sem React/Supabase) — testável em node:test.
 */

/** Status cru persistido em `leads.status`. */
export type LeadStatusCru = "new" | "accepted" | "rejected" | (string & {});

/** Situação exibida ao inquilino (chave estável). */
export type SituacaoCandidatura = "enviada" | "em_analise" | "aceita" | "nao_seguiu";

export interface RotuloCandidatura {
  chave: SituacaoCandidatura;
  /** Texto exibido (com emoji quando faz sentido). Sem jargão. */
  label: string;
  /** Tom da UI (chip). */
  tom: "neutro" | "andamento" | "sucesso" | "encerrado";
}

const ROTULOS: Record<SituacaoCandidatura, RotuloCandidatura> = {
  enviada: { chave: "enviada", label: "Enviada", tom: "neutro" },
  em_analise: { chave: "em_analise", label: "Em análise", tom: "andamento" },
  aceita: { chave: "aceita", label: "Aceita 🎉", tom: "sucesso" },
  nao_seguiu: { chave: "nao_seguiu", label: "Não seguiu adiante", tom: "encerrado" },
};

/**
 * Deriva a situação do inquilino a partir do status cru + se o proprietário já
 * interagiu (respondeu/mandou mensagem). Sem interação, "Enviada"; com o dono
 * já engajado mas sem decisão, "Em análise". Aceite/recusa mandam no resto.
 */
export function situacaoCandidatura(
  status: LeadStatusCru,
  ownerEngajou = false,
): RotuloCandidatura {
  if (status === "accepted") return ROTULOS.aceita;
  if (status === "rejected") return ROTULOS.nao_seguiu;
  // status "new" (ou desconhecido): em aberto.
  return ownerEngajou ? ROTULOS.em_analise : ROTULOS.enviada;
}

/** Todos os rótulos (para legendas/estados vazios). */
export const ROTULOS_CANDIDATURA = ROTULOS;
