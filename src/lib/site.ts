/** Configuração central do site / domínio de produção. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://vivanomads.com.br";

export const SITE_NAME = "Viva Nomads";
export const SITE_DOMAIN = "vivanomads.com.br";

/**
 * E-mail público do suporte: o único endereço que o site mostra, remetente e
 * "responder para" dos e-mails de chamado. contato@ até o apelido suporte@
 * existir (decisão do Daniel, out/2026) — trocar só aqui.
 */
export const SUPORTE_EMAIL = "contato@vivanomads.com.br";
