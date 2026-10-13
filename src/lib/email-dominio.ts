/**
 * Domínio do e-mail no cadastro (F2, ordem d90cbe91). Domínios reservados
 * (RFC 2606/6761) nunca recebem e-mail: o provedor recusa com 550 e o Supabase
 * responde 500. Barramos no servidor antes do signUp, com mensagem clara.
 */
export const MSG_EMAIL_INUTILIZAVEL =
  "Não conseguimos usar este e-mail. Confira se está digitado certo ou use outro endereço.";

const RESERVADOS = new Set(["example.com", "example.net", "example.org"]);
const SUFIXOS_RESERVADOS = [".test", ".invalid", ".localhost", ".example", ".local"];

export function dominioDoEmail(email: string): string | null {
  const t = email.trim().toLowerCase();
  const i = t.lastIndexOf("@");
  if (i < 1 || i === t.length - 1) return null;
  const d = t.slice(i + 1).replace(/\.$/, "");
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d) ? d : null;
}

export function dominioReservado(dominio: string): boolean {
  const d = dominio.toLowerCase();
  return (
    RESERVADOS.has(d) ||
    [...RESERVADOS].some((r) => d.endsWith(`.${r}`)) ||
    SUFIXOS_RESERVADOS.some((s) => d.endsWith(s)) ||
    d === "localhost"
  );
}
