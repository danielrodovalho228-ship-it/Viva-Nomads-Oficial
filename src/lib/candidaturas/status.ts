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
  aceita: { chave: "aceita", label: "Aceita", tom: "sucesso" },
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

/**
 * E314 (QA 31/10): o cartão em aberto ("Enviada" e "Em análise") também diz o que acontece agora e o próximo passo do
 * morador, no padrão do cartão "Aceita" (texto + link). "Em análise" quer dizer que o proprietário já mandou mensagem
 * sobre o imóvel (é assim que a situação é derivada), então o passo é responder pela conversa. O prazo é o oficial ("em até 1 dia útil"), só no "Em análise".
 */
export interface ProximoPassoCandidatura {
  agora: string;
  proximo: string;
  acao: { rotulo: string; href: string };
}

export const PROXIMO_PASSO_CANDIDATURA: Partial<Record<SituacaoCandidatura, ProximoPassoCandidatura>> = {
  enviada: {
    agora: "O proprietário recebeu a sua candidatura e ainda vai olhar.",
    proximo: "Fique de olho nas mensagens: a resposta do proprietário chega pela plataforma.",
    acao: { rotulo: "Ver mensagens", href: "/dashboard/mensagens" },
  },
  em_analise: {
    // E314 (devolução 31/10): o prazo oficial de resposta do proprietário no cartão "Em análise".
    agora: "O proprietário já viu a sua candidatura e está avaliando. A resposta chega em até 1 dia útil.",
    proximo: "Responda pela conversa e tire as dúvidas do proprietário; com a candidatura aceita, você envia os documentos aqui.",
    acao: { rotulo: "Abrir conversa", href: "/dashboard/mensagens" },
  },
};
