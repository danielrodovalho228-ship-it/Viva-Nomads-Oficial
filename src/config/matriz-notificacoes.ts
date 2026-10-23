/**
 * Matriz de notificações (Prompt 42, item 6 — base para o Prompt 44). Evento × papel × canal × categoria, a partir dos
 * eventos que já existem em src/lib/notifications/ (NotificationEvent, os de notify(), e os e-mails avulsos de
 * imagens-email.ts). Prompt 44: o notify() consulta esta matriz para decidir o push (regra-push.ts).
 *
 * Regras (Estudo 2, aprovado):
 *  • push SÓ para decisão com prazo, segurança e mensagem nova (Prompt 44: só sem a conversa aberta há 10 min, agrupada);
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
  // Prompt 59: prazo de solução (o morador vê "o proprietário foi avisado em …") e padrão mínimo de conforto.
  manutencao_prazo: { categoria: "decisao", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS, prazo: true },
  conforto_prazo: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  conforto_pendencia: { categoria: "decisao", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS, prazo: true },
  estadia_aditivo_proposto: { categoria: "decisao", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS, prazo: true },
  estadia_instrucoes_pendentes: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  pedido_confirmar_telefone: { categoria: "decisao", papeis: ["morador"], canais: TODOS_OS_CANAIS, prazo: true },
  // Prompt 38: o pedido automático espera o dono (janela da limpeza/reparo) e o parceiro que não respondeu em 24 h.
  pedido_auto_confirmar: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  pedido_auto_sem_resposta: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  // Prompt 62-B1: o avaliador aceita em 24 h; o morador concorda (ou não) com a data da visita no imóvel ocupado.
  vistoria_designada: { categoria: "decisao", papeis: ["parceiro"], canais: TODOS_OS_CANAIS, prazo: true },
  vistoria_concordancia: { categoria: "decisao", papeis: ["morador"], canais: TODOS_OS_CANAIS, prazo: true },
  vistoria_laudo_emitido: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  vistoria_fora_da_busca: { categoria: "decisao", papeis: ["proprietario"], canais: TODOS_OS_CANAIS, prazo: true },
  vistoria_devolucao: { categoria: "decisao", papeis: ["parceiro"], canais: TODOS_OS_CANAIS, prazo: true },
  vistoria_correcao_enviada: { categoria: "decisao", papeis: ["parceiro"], canais: TODOS_OS_CANAIS, prazo: true },

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
  vistoria_designado_dono: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  vistoria_agendada: { categoria: "decisao", papeis: ["proprietario", "parceiro"], canais: SEM_PUSH },
  vistoria_ausencia: { categoria: "decisao", papeis: ["proprietario", "parceiro"], canais: SEM_PUSH },
  vistoria_ressalva_vencida: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  vistoria_strike: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  vistoria_verificacao: { categoria: "decisao", papeis: ["proprietario"], canais: SEM_PUSH },
  vinculo_parceiro_convite: { categoria: "decisao", papeis: ["parceiro"], canais: SEM_PUSH },
  parceiro_orcamento_recebido: { categoria: "decisao", papeis: CLIENTE, canais: SEM_PUSH },
  parceiro_entrega_feita: { categoria: "decisao", papeis: CLIENTE, canais: SEM_PUSH },

  // ── Segurança (push permitido, sem interruptor) ───────────────────────────
  verification_ready: { categoria: "seguranca", papeis: ["morador"], canais: TODOS_OS_CANAIS },
  contract_signature_code: { categoria: "seguranca", papeis: DUAS_PARTES, canais: SO_EMAIL },
  recuperacao_2fa: { categoria: "seguranca", papeis: ["morador", "proprietario", "parceiro", "admin"], canais: SO_EMAIL },
  exclusao_conta: { categoria: "seguranca", papeis: ["morador", "proprietario", "parceiro"], canais: SO_EMAIL },

  // ── Mensagens (com interruptor) ───────────────────────────────────────────
  // Prompt 44: mensagem nova tem push, mas só se a pessoa não abriu a conversa nos últimos 10 min, agrupado
  // ("3 mensagens novas de Ana", sem o texto) — regra em src/lib/notifications/regra-push.ts.
  new_message: { categoria: "mensagens", papeis: DUAS_PARTES, canais: TODOS_OS_CANAIS },
  manutencao_mensagem: { categoria: "mensagens", papeis: DUAS_PARTES, canais: SEM_PUSH },
  chamado_respondido: { categoria: "mensagens", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  pedido_resposta: { categoria: "mensagens", papeis: ["morador"], canais: SEM_PUSH },
  pedido_aceito: { categoria: "mensagens", papeis: ["proprietario"], canais: SEM_PUSH },

  // ── Lembretes (com interruptor) ───────────────────────────────────────────
  checkin_lembrete: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  saida_lembrete: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  vistoria_lembrete: { categoria: "lembretes", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  // 63-B: "Reconecte seu LinkedIn para manter o selo" (30 dias antes de vencer).
  linkedin_vencendo: { categoria: "lembretes", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
  vistoria_vistoriado_expira: { categoria: "lembretes", papeis: ["proprietario"], canais: SEM_PUSH },
  renovacao_aviso: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  avaliacao_pedido: { categoria: "lembretes", papeis: DUAS_PARTES, canais: SEM_PUSH },
  anuncio_incompleto: { categoria: "lembretes", papeis: ["proprietario"], canais: SEM_PUSH },
  verificacao_parada: { categoria: "lembretes", papeis: ["morador", "proprietario", "parceiro"], canais: SEM_PUSH },
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
  // 61-B: o convidado pode não ter conta ainda — só e-mail (a central e o push dependem da conta).
  estadia_convite_ocupante: { categoria: "outros", papeis: ["morador"], canais: SO_EMAIL },
  estadia_remarcada: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  vinculo_parceiro_resposta: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  pedido_auto_atualizado: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  pedido_auto_cancelado: { categoria: "outros", papeis: ["parceiro"], canais: SEM_PUSH },
  saida_sem_parceiro: { categoria: "lembretes", papeis: ["proprietario"], canais: SEM_PUSH },
  sugestao_parceiros_morador: { categoria: "outros", papeis: ["morador"], canais: SEM_PUSH },
  internet_remedir: { categoria: "lembretes", papeis: ["proprietario"], canais: SEM_PUSH },
  internet_abaixo_medida: { categoria: "outros", papeis: ["proprietario"], canais: SEM_PUSH },
  estadia_encerramento_pedido: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  recibo_emitido: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },
  comprovante_caucao: { categoria: "outros", papeis: DUAS_PARTES, canais: SEM_PUSH },

  // ── Equipe (o admin desliga em "Receber alertas da equipe") ───────────────
  // Prompt 44 (item 3): alertas operacionais com push — só admins com "receber alertas operacionais".
  chamado_equipe: { categoria: "outros", papeis: ["admin"], canais: TODOS_OS_CANAIS },
  alerta_backup_falhou: { categoria: "outros", papeis: ["admin"], canais: TODOS_OS_CANAIS },
  alerta_email_falhou: { categoria: "outros", papeis: ["admin"], canais: ["push", "central"] },
  vistoria_sem_avaliador: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  // 63-B: tentativa de conectar um LinkedIn que já está em outra conta (sinal ao atendimento, sem expor quem).
  linkedin_ja_conectado: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  vistoria_fila_admin: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  parceiro_sem_resposta: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  chamado_fora_promessa: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  verificacao_analise_humana: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  documento_recebido: { categoria: "outros", papeis: ["admin"], canais: TODOS_OS_CANAIS },
  parceria_equipe: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
  estadia_encerramento_equipe: { categoria: "outros", papeis: ["admin"], canais: SEM_PUSH },
} as const satisfies Record<EventoNotificacao, LinhaMatriz>;

/** Prompt 44 (item 3): alertas da equipe que vão por push (documento na fila, chamado P1/P2, cópia noturna, e-mail). */
export const ALERTAS_OPERACIONAIS_COM_PUSH = ["documento_recebido", "chamado_equipe", "alerta_backup_falhou", "alerta_email_falhou"] as const;

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

/** Prompt 44 (item 4): as categorias que a pessoa pode desligar em /dashboard/notificacoes. */
export const CATEGORIAS_COM_INTERRUPTOR = ["mensagens", "lembretes", "outros"] as const;
export type CategoriaComInterruptor = (typeof CATEGORIAS_COM_INTERRUPTOR)[number];

/** O que vem do banco ou do formulário, só com categorias que têm interruptor, sem repetição e na ordem da tela. */
export function categoriasDesligadasValidas(valor: unknown): CategoriaComInterruptor[] {
  if (!Array.isArray(valor)) return [];
  return CATEGORIAS_COM_INTERRUPTOR.filter((c) => valor.includes(c));
}

/** A pessoa desligou a categoria deste evento? Decisão e segurança nunca: sempre chegam. */
export function eventoDesligadoPelaPessoa(evento: string, desligadas: readonly string[] | null | undefined): boolean {
  const l = (MATRIZ_NOTIFICACOES as Record<string, LinhaMatriz | undefined>)[evento];
  if (!l || !categoriaTemInterruptor(l.categoria) || !desligadas?.length) return false;
  return desligadas.includes(l.categoria);
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
