/*
  E287 — ENVIO do e-mail às pioneiras, pela pilha oficial da plataforma (sendEmail → Resend).
  ETAPA DE PROVA: este módulo só sabe enviar a CÓPIA DE PROVA, e só para a conta de teste (DESTINO_PROVA). Não existe aqui
  função que envie às destinatárias reais: o envio real fica TRAVADO até o chat principal liberar por escrito.

  `interno: true` é o que impede o comMarca (que acrescentaria " · Viva Nomads" ao assunto aprovado). Remetente e resposta
  são os OFICIAIS de cliente, passados explicitamente (REMETENTE e REMETENTE_EMAIL), iguais aos de qualquer e-mail de cliente.
*/
import { sendEmail, type EmailResult } from "./email.ts";
import { REMETENTE, REMETENTE_EMAIL } from "./remetente.ts";
import { PIONEIRAS, emailPioneira, type Pioneira } from "./pioneiras-e287.ts";

/** Conta de teste (is_teste) que recebe as provas; cai na caixa de e-mails de teste. */
export const DESTINO_PROVA = "proprietario1@vivanomads.com.br";
export const EVENTO_PROVA = "pioneiras_e287_prova";

export async function enviarProvaPioneira(p: Pioneira, usuarioIdTeste: string): Promise<EmailResult> {
  const e = emailPioneira(p);
  return sendEmail({
    to: DESTINO_PROVA,
    subject: e.subject,
    html: e.html,
    text: e.text,
    interno: true,
    from: REMETENTE,
    replyTo: REMETENTE_EMAIL,
    evento: EVENTO_PROVA,
    usuarioId: usuarioIdTeste,
  });
}

/** Uma cópia de prova de CADA texto. */
export async function enviarProvasPioneiras(usuarioIdTeste: string): Promise<{ chave: string; resultado: EmailResult }[]> {
  const saida: { chave: string; resultado: EmailResult }[] = [];
  for (const p of PIONEIRAS) saida.push({ chave: p.chave, resultado: await enviarProvaPioneira(p, usuarioIdTeste) });
  return saida;
}
