/*
  Pedido de moradia: só chega aos proprietários depois de e-mail E telefone confirmados
  (ordem 8dca1437, item 3). Módulo PURO. A regra do mural vale no banco (migração 0157);
  aqui ficam o critério usado pelos avisos e o texto da tela.
*/

export interface SituacaoContato {
  /** auth.users.email_confirmed_at */
  emailConfirmadoEm: string | null | undefined;
  /** auth.users.phone_confirmed_at */
  telefoneConfirmadoEm: string | null | undefined;
  /** public.telefone_verificacao.verificado_em (zera ao trocar de número). */
  telefoneVerificadoEm: string | null | undefined;
}

export function faltaConfirmar(s: SituacaoContato): ("e-mail" | "telefone")[] {
  const falta: ("e-mail" | "telefone")[] = [];
  if (!s.emailConfirmadoEm) falta.push("e-mail");
  if (!s.telefoneConfirmadoEm || !s.telefoneVerificadoEm) falta.push("telefone");
  return falta;
}

export function contatoConfirmado(s: SituacaoContato): boolean {
  return faltaConfirmar(s).length === 0;
}

/** Aviso do formulário e da tela de "Pedido publicado". */
export const AVISO_CONFIRMACAO =
  "Seu pedido só chega aos proprietários com e-mail e telefone confirmados. Seu contato continua escondido até você aceitar uma resposta.";

/** Onde a pessoa confirma o telefone. */
export const ROTA_CONFIRMAR_CONTATO = "/dashboard/conta/perfil";
