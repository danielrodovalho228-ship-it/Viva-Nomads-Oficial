/*
  Imagem de cabeçalho de CADA e-mail de cliente (rota rápida "e-mails profissionais", item 3) — PURO.
  Evento → tema → arquivo em public/media/email/. Os temas novos (visita, contrato, proposta…) são gerados pelo
  Moacir no Google Flow (prompts em docs/email-image-prompts.md); enquanto o arquivo não está no repositório, o tema
  usa a imagem existente mais próxima — nunca a de outro assunto (documento nunca usa candidatura nem pedido).
  Quando um arquivo novo chegar: põe em public/media/email/ e acrescenta o nome em IMAGENS_NO_REPOSITORIO
  (o teste avisa se esquecer).
*/
import type { NotificationEvent } from "./eventos-email.ts";

/** Arquivos que existem hoje em public/media/email/ (sem a extensão .jpg). */
export const IMAGENS_NO_REPOSITORIO = new Set<string>([
  "candidatura-recebida",
  "confirmar-cadastro",
  "convite",
  "link-de-acesso",
  "nova-mensagem",
  "novo-interessado",
  "pedido-resposta",
  "reautenticacao",
  "redefinir-senha",
  "transacional",
  "trocar-email",
]);

/** Temas novos (arquivo a gerar) → imagem existente que vale até ele chegar. */
export const TEMAS_NOVOS: Record<string, { provisoria: string; alt: string }> = {
  visita: { provisoria: "novo-interessado", alt: "Visita ao imóvel mobiliado" },
  contrato: { provisoria: "transacional", alt: "Contrato da estadia" },
  proposta: { provisoria: "pedido-resposta", alt: "Proposta entre proprietário e morador" },
  "documento-pdf": { provisoria: "transacional", alt: "Documento da estadia" },
  seguranca: { provisoria: "reautenticacao", alt: "Segurança da sua conta" },
  atendimento: { provisoria: "nova-mensagem", alt: "Atendimento Viva Nomads" },
  manutencao: { provisoria: "nova-mensagem", alt: "Manutenção no imóvel" },
  verificacao: { provisoria: "confirmar-cadastro", alt: "Verificação concluída" },
  documentos: { provisoria: "transacional", alt: "Conferência dos documentos do imóvel" },
  avaliacao: { provisoria: "transacional", alt: "Avaliação da estadia" },
  busca: { provisoria: "transacional", alt: "Imóveis mobiliados para a sua busca" },
};

const ALT_EXISTENTE: Record<string, string> = {
  "candidatura-recebida": "Candidatura pela plataforma",
  "nova-mensagem": "Conversa pela plataforma",
  "novo-interessado": "Pessoa buscando imóveis no notebook",
  "pedido-resposta": "Acordo entre proprietário e inquilino",
  transacional: "Imóvel mobiliado para estadia",
};

/** Eventos que não passam pelo notify (enviados direto pelo sendEmail). */
export type EventoAvulso = "recibo_emitido" | "comprovante_caucao" | "termo_devolucao" | "contract_signature_code" | "recuperacao_2fa" | "exclusao_conta" | "parceria_aprovada";

export const TEMA_POR_EVENTO: Record<NotificationEvent | EventoAvulso, string> = {
  new_lead: "novo-interessado",
  new_message: "nova-mensagem",
  application_received: "candidatura-recebida",
  candidatura_aceita: "nova-mensagem",
  candidatura_nova: "novo-interessado",
  anuncio_compartilhar: "transacional",
  saved_search_match: "busca",
  verification_ready: "verificacao",
  contract_status: "contrato",
  subscription_status: "transacional",
  pedido_novo_cidade: "busca",
  pedido_compativel: "busca",
  pedido_resumo: "busca",
  pedido_imovel_novo: "busca",
  pedido_resposta: "pedido-resposta",
  pedido_aceito: "nova-mensagem",
  pedido_expirando: "transacional",
  pedido_confirmar_telefone: "transacional",
  pedido_encerrado: "transacional",
  pedido_moderado: "transacional",
  documento_aprovado: "documentos",
  documento_recusado: "documentos",
  documento_recebido: "documentos",
  checklist_aprovado: "verificacao",
  checklist_recusado: "verificacao",
  chamado_aberto: "atendimento",
  chamado_respondido: "atendimento",
  chamado_resolvido: "atendimento",
  chamado_equipe: "atendimento",
  manutencao_nova: "manutencao",
  manutencao_atrasada: "manutencao",
  manutencao_atualizada: "manutencao",
  manutencao_mensagem: "manutencao",
  checkin_lembrete: "contrato",
  saida_lembrete: "contrato",
  renovacao_aviso: "contrato",
  anuncio_incompleto: "transacional",
  avaliacao_pedido: "avaliacao",
  proposta_recebida: "proposta",
  proposta_respondida: "proposta",
  proposta_vencendo: "proposta",
  visita_pedida: "visita",
  visita_confirmada: "visita",
  visita_remarcada: "visita",
  visita_cancelada: "visita",
  recibo_emitido: "documento-pdf",
  comprovante_caucao: "documento-pdf",
  termo_devolucao: "documento-pdf",
  contract_signature_code: "contrato",
  recuperacao_2fa: "seguranca",
  exclusao_conta: "seguranca",
  parceria_recebida: "transacional",
  parceria_recusada: "transacional",
  parceria_equipe: "atendimento",
  parceria_convite: "transacional",
  parceria_aprovada: "verificacao",
};

/** Arquivo (sem .jpg) e texto alternativo da imagem do evento — sempre um arquivo que existe. */
export function imagemDoEvento(evento: NotificationEvent | EventoAvulso, noRepositorio: Set<string> = IMAGENS_NO_REPOSITORIO): { arquivo: string; alt: string } {
  const tema = TEMA_POR_EVENTO[evento] ?? "transacional";
  const novo = TEMAS_NOVOS[tema];
  if (novo) return { arquivo: noRepositorio.has(tema) ? tema : novo.provisoria, alt: novo.alt };
  return { arquivo: noRepositorio.has(tema) ? tema : "transacional", alt: ALT_EXISTENTE[tema] ?? "Viva Nomads" };
}
