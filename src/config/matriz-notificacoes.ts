/**
 * Matriz de notificações (Prompt 42, item 6 — base para o Prompt 44). Evento × papel × canal × categoria, a partir dos
 * eventos que já existem em src/lib/notifications/ (NotificationEvent, os de notify(), e os e-mails avulsos de
 * imagens-email.ts). AINDA NÃO muda o notify(): o Prompt 44 liga esta matriz ao envio.
 *
 * Regras (Estudo 2, aprovado):
 *  • push SÓ para decisão com prazo e para segurança;
 *  • mensagens, lembretes e outros têm interruptor (a pessoa desliga);
 *  • decisão e segurança NÃO têm interruptor (sempre chegam).
 * Códigos (assinatura, recuperação de duas etapas) e o aviso de exclusão da conta vão só por e-mail: código não aparece
 * em notificação de tela e a conta excluída não tem central.
 * Roda: node --test src/config/matriz-notificacoes.test.ts
 */
import type { NotificationEvent } from "../lib/notifications/eventos-email.ts";
import type { EventoAvulso } from "../lib/notifications/imagens-email.ts";

export type CanalNotificacao = "push" | "central" | "email";
export type CategoriaNotificacao = "decisao" | "seguranca" | "mensagens" | "lembretes" | "outros";
export type PapelNotificacao = "morador" | "proprietario" | "parceiro" | "admin";
export type EventoNotificacao = NotificationEvent | EventoAvulso;

export interface LinhaMatriz {
  categoria: CategoriaNotificacao;
  /** Quem recebe este evento. */
  papeis: PapelNotificacao[];
  canais: CanalNotificacao[];
  /** Decisão com prazo (proposta que vence, horário da visita, prazo da manutenção…): é o que libera o push. */
  prazo?: boolean;
}

const DUAS_PARTES: PapelNotificacao[] = ["morador", "proprietario"];
const CLIENTE: PapelNotificacao[] = ["morador", "proprietario"];
const TODOS_OS_CANAIS: CanalNotificacao[] = ["push", "central", "email"];
const SEM_PUSH: CanalNotificacao[] = ["central", "email"];
const SO_EMAIL: CanalNotificacao[] = ["email"];

export const MATRIZ_NOTIFICACOES = {
  // ── Decisões com prazo (push) ─────────────────────────────────────────────
  proposta_recebida: { categoria: "decisao", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS, prazo: true },
  proposta_vencendo: { categoria: "decisao", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS, prazo: true },
  visita_pedida: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  visita_remarcada: { categoria: "decisao", papeis: ["morador"], canais: TODOS_OS_CANAIS, prazo: true },
  manutencao_nova: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  manutencao_atrasada: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  estadia_aditivo_proposto: { categoria: "decisao", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS, prazo: true },
  estadia_instrucoes_pendentes: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  pedido_confirmar_telefone: { categoria: "decisao", papeis: ["morador"], canais: TODOS_OS_CANAIS, prazo: true },

  // ── Decisões sem prazo (central + e-mail) ─────────────────────────────────
  new_lead: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  application_received: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  candidatura_nova: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  contract_status: { categoria: "decisao", papeis: DUAS_PARTES, canais: SEM_PUSH },
  estadia_aditivo_respondido: { categoria: "decisao", papeis: DUAS_PARTES, canais: SEM_PUSH },
  documento_recusado: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  checklist_recusado: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  termo_devolucao: { categoria: "decisao", papeis: ["morador"], canais: SEM_PUSH },
  parceiro_pedido_novo: { categoria: "decisao", papeis: ["parceiro"], canais: SEM_PUSH },
  parceiro_orcamento_recebido: { categoria: "decisao", papeis: CLIENTE, canais: SEM_PUSH },
  parceiro_entrega_feita: { categoria: "decisao", papeis: CLIENTE, canais: SEM_PUSH },

  // ── Segurança (push permitido, sem interruptor) ───────────────────────────
  verification_ready: { categoria: "seguranca", papeis: ["morador"], canais: TODOS_OS_CANAIS },
  contract_signature_code: { categoria: "seguranca", papeis: DUAS_PARTES, canais: SO_EMAIL },
  recuperacao_2fa: { categoria: "seguranca", papeis: ["morador", "proprietario", "parceiro", "admin"], canais: SO_EMAIL },
  exclusao_conta: { categoria: "seguranca", papeis: ["morador", "proprietario", "parceiro"], canais: SO_EMAIL },

  // ── Mensagens (com interruptor) ───────────────────────────────────────────
  new_message: { categoria: "mensagens", papeis: DUAS_PARTES, canais: SEM_PUSH },
  manutencao_mensagem: { categoria: "mensagens", papeis: DUAS_PARTES, canais: SEM_PUSH },
  chamado_respondido: { categoria: "mensagens", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  pedido_resposta: { categoria: "mensagens", papeis: ["morador"], canais: SEM_PUSH },
  pedido_aceito: { categoria: "mensagens", papeis: ["proprietario"], canais: SEM_PUSH },

  // ── Lembretes (com interruptor) ───────────────────────────────────────────
  checkin_lembrete: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  saida_lembrete: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  renovacao_aviso: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  avaliacao_pedido: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  anuncio_incompleto: { categoria: "lembretes", papeis: ["proprietario"], canais: SEM_PUSH },
  pedido_expirando: { categoria: "lembretes", papeis: ["morador"], canais: SEM_PUSH },
  parceiro_lembrete: { categoria: "lembretes", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  parceiro_conclusao_pendente: { categoria: "lembretes", papeis: CLIENTE, canais: SEM_PUSH },
  parceiro_avaliacao: { categoria: "lembretes", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },

  // ── Outros avisos (com interruptor) ───────────────────────────────────────
  candidatura_aceita: { categoria: "outros", papeis: ["morador"], canais: SEM_PUSH },
  proposta_respondida: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  visita_confirmada: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  visita_cancelada: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  saved_search_match: { categoria: "outros", papeis: ["morador"], canais: SEM_PUSH },
  subscription_status: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  pedido_novo_cidade: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  pedido_compativel: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  pedido_resumo: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  pedido_imovel_novo: { categoria: "outros", papeis: ["morador"], canais: SEM_PUSH },
  pedido_moderado: { categoria: "outros", papeis: ["morador"], canais: SEM_PUSH },
  pedido_encerrado: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  documento_aprovado: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  checklist_aprovado: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  chamado_aberto: { categoria: "outros", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  chamado_resolvido: { categoria: "outros", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  manutencao_atualizada: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  anuncio_compartilhar: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  parceria_recebida: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  parceria_recusada: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  parceria_convite: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  parceria_aprovada: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  parceiro_orcamento_aceito: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  parceiro_horario_confirmado: { categoria: "outros", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  estadia_instrucoes_liberadas: { categoria: "outros", papeis: ["morador"], canais: SEM_PUSH },
  estadia_remarcada: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  estadia_encerramento_pedido: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  recibo_emitido: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  comprovante_caucao: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },

  // ── Equipe (o admin desliga em "Receber alertas da equipe") ───────────────
  chamado_equipe: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  documento_recebido: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  parceria_equipe: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  estadia_encerramento_equipe: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
} as const satisfies Record<EventoNotificacao, LinhaMatriz>;

/** Os canais deste evento para este papel ([] quando o papel não recebe o evento). */
export function canaisDoEvento(evento: EventoNotificacao, papel: PapelNotificacao): CanalNotificacao[] {
  const l: LinhaMatriz | undefined = MATRIZ_NOTIFICACOES[evento];
  if (!l || !l.papeis.includes(papel)) return [];
  return [...l.canais];
}

/** A pessoa pode desligar esta categoria? Decisão e segurança, não (sempre chegam). */
export function categoriaTemInterruptor(categoria: CategoriaNotificacao): boolean {
  return categoria !== "decisao" && categoria !== "seguranca";
}

/** A categoria do evento. */
export function categoriaDoEvento(evento: EventoNotificacao): CategoriaNotificacao {
  return MATRIZ_NOTIFICACOES[evento].categoria;
}

/** Rótulos das categorias (para a tela de preferências quando o Prompt 44 ligar a matriz). */
export const ROTULO_CATEGORIA: Record<CategoriaNotificacao, string> = {
  decisao: "Decisões",
  seguranca: "Segurança",
  mensagens: "Mensagens",
  lembretes: "Lembretes",
  outros: "Outros avisos",
};
