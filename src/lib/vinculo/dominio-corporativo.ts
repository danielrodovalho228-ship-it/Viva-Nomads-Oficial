/**
 * Vínculo profissional por e-mail corporativo/institucional (ordem 9950ef15, item 2).
 * Só o NOME DO DOMÍNIO é guardado e exibido; provedores gratuitos são recusados.
 */
const PROVEDORES_GRATUITOS = new Set([
  "gmail.com", "googlemail.com", "hotmail.com", "hotmail.com.br", "outlook.com", "outlook.com.br",
  "live.com", "msn.com", "yahoo.com", "yahoo.com.br", "ymail.com", "icloud.com", "me.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "ig.com.br", "globo.com", "globomail.com",
  "proton.me", "protonmail.com", "aol.com", "zoho.com", "gmx.com", "mail.com",
]);

export type DominioCorporativo = { ok: true; dominio: string } | { ok: false };

export function dominioCorporativo(email: string | null | undefined): DominioCorporativo {
  const v = (email ?? "").trim().toLowerCase();
  const m = /^[^\s@]+@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/.exec(v);
  if (!m) return { ok: false };
  const dominio = m[1];
  if (PROVEDORES_GRATUITOS.has(dominio)) return { ok: false };
  return { ok: true, dominio };
}
