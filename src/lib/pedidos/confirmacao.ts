/*
  Pedido de moradia: quando ele chega aos proprietários. Módulo PURO. A regra do mural vale no banco
  (pedido_visivel_para_donos, 0184); aqui ficam o critério usado pelos avisos e os textos da tela.

  Chave SMS_ATIVO (Prompt 30, decisão do Daniel em 18/10):
   • desligada (padrão; o provedor de SMS ainda não está configurado): basta o e-mail confirmado dos dois lados.
     Nenhuma tela nem e-mail pede o telefone para os donos verem o pedido.
   • ligada: volta a exigência da 0160 (telefone confirmado). Pedido que já estava publicado quando a chave foi
     ligada tem 7 dias para a pessoa confirmar antes de sair do ar.
*/

export interface SituacaoContato {
  /** auth.users.email_confirmed_at */
  emailConfirmadoEm: string | null | undefined;
  /** auth.users.phone_confirmed_at */
  telefoneConfirmadoEm: string | null | undefined;
  /** public.telefone_verificacao.verificado_em (zera ao trocar de número). */
  telefoneVerificadoEm: string | null | undefined;
}

export interface ChaveSms {
  ligada: boolean;
  ligadaEm: string | null;
}

export const PRAZO_CONFIRMAR_TELEFONE_DIAS = 7;

export function telefoneConfirmado(s: SituacaoContato): boolean {
  return !!s.telefoneConfirmadoEm && !!s.telefoneVerificadoEm;
}

/** O que falta para o pedido chegar aos donos, conforme a chave. */
export function faltaConfirmar(s: SituacaoContato, sms: ChaveSms = { ligada: false, ligadaEm: null }): ("e-mail" | "telefone")[] {
  const falta: ("e-mail" | "telefone")[] = [];
  if (!s.emailConfirmadoEm) falta.push("e-mail");
  if (sms.ligada && !telefoneConfirmado(s)) falta.push("telefone");
  return falta;
}

/**
 * O pedido chega aos donos? Espelha pedido_visivel_para_donos (0184): e-mail confirmado; com a chave ligada, também o
 * telefone — salvo pedido publicado antes de a chave ser ligada, dentro dos 7 dias de prazo.
 */
export function chegaAosDonos(s: SituacaoContato, sms: ChaveSms, pedidoCriadoEm: string | null, agora: Date): boolean {
  if (!s.emailConfirmadoEm) return false;
  if (!sms.ligada || telefoneConfirmado(s)) return true;
  if (!sms.ligadaEm || !pedidoCriadoEm) return false;
  const ligada = Date.parse(sms.ligadaEm);
  return Date.parse(pedidoCriadoEm) < ligada && agora.getTime() < ligada + PRAZO_CONFIRMAR_TELEFONE_DIAS * 86_400_000;
}

/** Compatibilidade com quem só sabe dos dados de contato (sem a data do pedido). */
export function contatoConfirmado(s: SituacaoContato, sms: ChaveSms = { ligada: false, ligadaEm: null }): boolean {
  return faltaConfirmar(s, sms).length === 0;
}

/** Aviso do formulário e da tela de "Pedido publicado". Acompanha a chave. */
export function avisoConfirmacao(smsLigado: boolean): string {
  return smsLigado
    ? "Seu pedido só chega aos proprietários com e-mail e telefone confirmados. Seu contato continua escondido até você aceitar uma resposta."
    : "Seu pedido chega aos proprietários com o seu e-mail confirmado. Seu contato continua escondido até você aceitar uma resposta.";
}

/** Título do aviso quando falta confirmar algo (só o que falta de verdade). */
export function tituloFaltaConfirmar(falta: ("e-mail" | "telefone")[]): string {
  if (falta.length === 2) return "Falta confirmar seu e-mail e telefone.";
  return falta[0] === "telefone" ? "Falta confirmar seu telefone." : "Falta confirmar seu e-mail.";
}

/** Aviso ao inquilino quando a chave é ligada e o telefone dele não está confirmado. */
export function textoAvisoTelefone(prazoISO: string): string {
  const d = new Date(prazoISO);
  const data = Number.isFinite(d.getTime()) ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "";
  return `Para o seu pedido de moradia continuar visível aos proprietários, confirme o seu telefone até ${data}. Depois disso ele sai do ar até a confirmação.`;
}

/** Selos do cartão do dono (nunca contato). */
export interface SeloPedido {
  codigo: "email" | "identidade" | "telefone";
  texto: string;
  ok: boolean;
}
export function selosDoPedido(s: { emailConfirmado: boolean; telefoneConfirmado: boolean; identidadeConfirmada: boolean }): SeloPedido[] {
  const out: SeloPedido[] = [];
  if (s.emailConfirmado) out.push({ codigo: "email", texto: "E-mail confirmado", ok: true });
  if (s.identidadeConfirmada) out.push({ codigo: "identidade", texto: "Identidade confirmada", ok: true });
  out.push(s.telefoneConfirmado ? { codigo: "telefone", texto: "Telefone confirmado", ok: true } : { codigo: "telefone", texto: "Telefone ainda não confirmado", ok: false });
  return out;
}

/** Onde a pessoa confirma o telefone/e-mail. */
export const ROTA_CONFIRMAR_CONTATO = "/dashboard/conta/perfil";
