/** Configuração central do site / domínio de produção. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://vivanomads.com.br";

export const SITE_NAME = "Viva Nomads";
export const SITE_DOMAIN = "vivanomads.com.br";
