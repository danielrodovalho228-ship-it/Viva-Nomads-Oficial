/*
  E664 — Canal de emergência no dia da chegada (PURO). O botão "Falar com o proprietário agora" aparece na conversa da
  plataforma SÓ no dia da entrada, para o morador de contrato ativo assinado pelas duas partes. Aciona um aviso urgente
  ao proprietário (push + sino + e-mail) e registra uma mensagem na conversa; a Viva é a intermediária — nenhum contato
  (telefone, e-mail) é mostrado nem trocado (regra do E444/E445 intacta). A data de entrada vem dos blocos ATUAIS do
  contrato: remarcou por aditivo (E652), vale a nova.
*/

export const ROTULO_BOTAO_EMERGENCIA = "Falar com o proprietário agora";
/** Espera mínima entre dois acionamentos do mesmo contrato (anti-spam; a conta é do limitador do servidor). */
export const ESPERA_ENTRE_ACIONAMENTOS_MIN = 10;

export const TEXTO_EMERGENCIA_ENVIADA =
  "Avisamos o proprietário agora, com urgência. A Viva acompanha e a resposta chega por aqui, nesta conversa. Nenhum telefone é compartilhado.";
export const TEXTO_EMERGENCIA_ESPERE = "O aviso urgente já foi enviado há pouco. Aguarde alguns minutos; a resposta chega nesta conversa.";
export const TEXTO_EMERGENCIA_INDISPONIVEL = "O aviso urgente só fica disponível no dia da entrada.";
export const MSG_EMERGENCIA_NA_CONVERSA = "Aviso urgente: cheguei ao imóvel e preciso falar agora. Responda por aqui, por favor.";

export function emergenciaDisponivel(i: {
  souMorador: boolean;
  status: string | null | undefined;
  assinadoPelasDuas: boolean;
  /** AAAA-MM-DD — primeira entrada dos blocos atuais. */
  entrada: string | null | undefined;
  /** AAAA-MM-DD de Brasília. */
  hoje: string;
}): boolean {
  if (!i.souMorador || !i.assinadoPelasDuas || i.status !== "ativo") return false;
  const entrada = String(i.entrada ?? "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(entrada) && entrada === String(i.hoje).slice(0, 10);
}
