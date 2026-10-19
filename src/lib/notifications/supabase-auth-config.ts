/*
  Corpo do PATCH na API de gestão do Supabase (/v1/projects/{ref}/config/auth) com os 6 e-mails de conta e o
  remetente — PURO, para o teste conferir os campos sem rede. Usado por scripts/aplicar-templates-supabase.ts.
*/
import { REMETENTE_EMAIL, REMETENTE_NOME } from "./remetente.ts";
import { templatesSupabase } from "./templates-supabase.ts";

/** Nome do modelo no painel → sufixo dos campos da API (mailer_subjects_<x> / mailer_templates_<x>_content). */
export const CAMPO_DO_MODELO: Record<string, string> = {
  "Confirm signup": "confirmation",
  "Reset password": "recovery",
  "Change email address": "email_change",
  "Invite user": "invite",
  "Magic link": "magic_link",
  Reauthentication: "reauthentication",
};

export function corpoConfigAuth(): Record<string, string> {
  const corpo: Record<string, string> = { smtp_admin_email: REMETENTE_EMAIL, smtp_sender_name: REMETENTE_NOME };
  for (const t of templatesSupabase()) {
    const campo = CAMPO_DO_MODELO[t.modelo];
    if (!campo) throw new Error(`Modelo sem campo na API: ${t.modelo}`);
    corpo[`mailer_subjects_${campo}`] = t.assunto;
    corpo[`mailer_templates_${campo}_content`] = t.html;
  }
  return corpo;
}

/** Campos que voltaram diferentes do que foi enviado (vazio = tudo conferido). */
export function camposDiferentes(enviado: Record<string, string>, lido: Record<string, unknown>): string[] {
  return Object.keys(enviado).filter((k) => String(lido[k] ?? "").trim() !== enviado[k].trim());
}
