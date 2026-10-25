/*
  Preferência de notificação — PURO. Critério 5 do Daniel: tudo LIGADO por
  padrão. Conta sem preferência salva (null/ausente) = ligada; só um "false"
  gravado pela própria pessoa desliga.
*/
export function notificacaoLigada(valor: boolean | null | undefined): boolean {
  return valor !== false;
}

/**
 * Prompt 51 F1: conta PAUSADA não recebe alertas nem lembretes (busca salva, resumos, automações, lembretes do funil).
 * Avisos de contrato, segurança e jurídicos continuam: esses caminhos não passam por aqui.
 */
export function recebeAvisoComum(p: { notif_email?: boolean | null; pausada_em?: string | null } | null | undefined): boolean {
  return !!p && notificacaoLigada(p.notif_email) && !p.pausada_em;
}

/**
 * A6 — Conta › Notificações, canal "Notificação no celular (push)": gravado pela própria pessoa em
 * user_metadata.notif_push. Mesma regra dos outros canais: só um false gravado desliga.
 */
export function pushLigado(meta: Record<string, unknown> | null | undefined): boolean {
  return notificacaoLigada(typeof meta?.notif_push === "boolean" ? meta.notif_push : null);
}
